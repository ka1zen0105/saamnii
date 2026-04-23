import { Student, Upload } from "../models/index.js";
import { Settings } from "../models/Settings.js";
import {
  computeGradeBands,
  subjectEsePercent,
  subjectIsePercent,
  subjectMsePercent,
  subjectTotalPercent,
} from "../utils/gradeBandAnalysis.js";

function parseSemester(q) {
  const raw = q?.semester;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function trimQuery(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeSubjectCode(value) {
  const raw = trimQuery(value);
  if (!raw) return "";
  const firstLine = raw.split(/\r?\n/)[0].trim();
  const firstToken = firstLine.split(/\s+/)[0].trim();
  return firstToken.toUpperCase();
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function subjectCodeSetFromUser(user) {
  const codes = Array.isArray(user?.subjectCodes) ? user.subjectCodes : [];
  return new Set(codes.map((c) => normalizeSubjectCode(c)).filter(Boolean));
}

/**
 * Builds Mongo filter from query + faculty scope. Throws { statusCode: 403 } when faculty
 * requests a class they are not assigned to.
 * @param {import('express').Request} req
 * @returns {Record<string, unknown>}
 */
async function buildScopedStudentFilter(req) {
  const classLabel = trimQuery(req.query.classLabel);
  const facultyIdQuery = trimQuery(req.query.facultyId);
  const semester = parseSemester(req.query);

  /** @type {Record<string, unknown>} */
  const filter = {};

  if (semester !== undefined) {
    filter.semester = semester;
  }

  const user = req.user;
  const role = user?.role;
  const assigned = Array.isArray(user?.assignedClasses)
    ? user.assignedClasses.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const facultyId = trimQuery(user?.userId);

  async function applyOwnUploadScope(targetFilter) {
    const ownUploads = facultyId
      ? await Upload.find({ facultyId }).select("uploadId").lean().exec()
      : [];
    const uploadIds = ownUploads
      .map((u) => trimQuery(u?.uploadId))
      .filter(Boolean);
    if (uploadIds.length === 0) {
      targetFilter.uploadId = { $in: [] };
    } else {
      targetFilter.uploadId = { $in: uploadIds };
    }
  }

  if (role === "faculty") {
    if (assigned.length === 0) {
      await applyOwnUploadScope(filter);
      if (classLabel) {
        filter.classLabel = classLabel;
      }
      return filter;
    }
    if (classLabel) {
      if (!assigned.includes(classLabel)) {
        const err = new Error("You are not assigned to this class.");
        err.statusCode = 403;
        throw err;
      }
      filter.classLabel = classLabel;
    } else {
      const assignedCount = await Student.countDocuments({ classLabel: { $in: assigned } });
      if (assignedCount > 0) {
        filter.classLabel = { $in: assigned };
      } else {
        // Assigned class labels may become stale; fall back to this faculty's own uploads.
        await applyOwnUploadScope(filter);
      }
    }
    return filter;
  }

  // Admin optional scope: view analytics for one faculty's uploaded data.
  if (role === "admin" && facultyIdQuery) {
    const uploads = await Upload.find({ facultyId: facultyIdQuery }).select("uploadId").lean().exec();
    const uploadIds = uploads.map((u) => trimQuery(u?.uploadId)).filter(Boolean);
    filter.uploadId = uploadIds.length ? { $in: uploadIds } : { $in: [] };
  }

  if (classLabel) {
    filter.classLabel = classLabel;
  }

  return filter;
}

async function loadScopedStudents(req) {
  const filter = await buildScopedStudentFilter(req);
  const students = await Student.find(filter).lean().exec();
  if (req.user?.role !== "faculty") return students;

  const allowed = subjectCodeSetFromUser(req.user);
  // Empty subjectCodes means no restriction (e.g. email-based mentor login).
  if (allowed.size === 0) return students;

  const scoped = [];
  for (const s of students) {
    const subs = Array.isArray(s.subjects) ? s.subjects : [];
    const filteredSubs = subs.filter((sub) => allowed.has(normalizeSubjectCode(sub?.code)));
    if (!filteredSubs.length) continue;
    scoped.push({ ...s, subjects: filteredSubs });
  }
  return scoped;
}

function normalizeGradeSymbol(g) {
  if (g === undefined || g === null) return "";
  return String(g).trim().toUpperCase();
}

function classifyOutcome(resultRaw) {
  const s = String(resultRaw ?? "").trim();
  if (!s) return "unknown";
  if (/fail|f\.?\s*t\.?|withheld|absent|disc(?:ontinued)?/iu.test(s)) return "fail";
  if (/pass|successful|complete|first\s*class|dist(?:inction)?|sat|cleared/iu.test(s)) {
    return "pass";
  }
  return "unknown";
}

function average(nums) {
  const vals = nums.filter((n) => Number.isFinite(n));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function bucketLabel(index) {
  if (index < 0 || index > 19) return "unknown";
  if (index === 19) return "95-100";
  const lo = index * 5;
  const hi = lo + 5;
  return `${lo}-${hi}`;
}

function bucketIndexForPercentage(pct) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const clamped = Math.max(0, Math.min(100, pct));
  return Math.min(19, Math.floor(clamped / 5));
}

function websiteRouteContextForRole(role) {
  if (role === "admin") {
    return [
      { to: "/admin/dashboard", label: "Dashboard", purpose: "Overview, updates, O-grade pie chart" },
      { to: "/admin/analysis-of-students", label: "Grade Band", purpose: "Faculty-wise grade charts" },
      { to: "/admin/analytics", label: "Analytics", purpose: "Bell curve analysis" },
      { to: "/admin/faculty-access", label: "Faculty Access", purpose: "Add faculty and allocate subjects" },
    ];
  }
  return [
    { to: "/faculty/dashboard", label: "Dashboard", purpose: "Overview and updates" },
    { to: "/faculty/upload", label: "Upload", purpose: "Upload workbook/result file" },
    { to: "/faculty/analytics", label: "Analytics", purpose: "Bell curve and advanced analysis" },
    { to: "/faculty/grade-bands", label: "Grade Bands", purpose: "Grade distribution graphs" },
    { to: "/faculty/profile", label: "Profile", purpose: "Update email/contact/password" },
  ];
}

function normalizeLinks(rawLinks, role) {
  const allowed = websiteRouteContextForRole(role);
  const allowMap = new Map(allowed.map((l) => [l.to, l]));
  if (!Array.isArray(rawLinks)) return [];
  const out = [];
  for (const row of rawLinks) {
    const to = trimQuery(row?.to);
    if (!allowMap.has(to)) continue;
    const safe = allowMap.get(to);
    out.push({
      to,
      label: trimQuery(row?.label) || safe.label,
    });
  }
  return out.slice(0, 4);
}

function looksLikeSubjectSummaryRequest(message) {
  const m = normalizeText(message);
  if (!m) return false;
  const asksSummary = /\b(summary|summarize|overview|report|analysis)\b/.test(m);
  const mentionsGrade = /\b(grade|grades|grading|performance|result)\b/.test(m);
  const mentionsSubject = /\b(subject|course)\b/.test(m);
  return asksSummary && (mentionsGrade || mentionsSubject);
}

function pickRequestedSubject(message, students) {
  const m = normalizeText(message);
  const subjectMap = new Map();
  for (const s of students) {
    for (const sub of s.subjects || []) {
      const code = trimQuery(sub?.code);
      const name = trimQuery(sub?.name);
      const key = code || name;
      if (!key) continue;
      subjectMap.set(key, { code, name });
    }
  }

  let best = null;
  let bestScore = 0;
  for (const cand of subjectMap.values()) {
    const codeNorm = normalizeText(cand.code);
    const nameNorm = normalizeText(cand.name);
    let score = 0;
    if (codeNorm && m.includes(codeNorm)) score += 3;
    if (nameNorm && m.includes(nameNorm)) score += 4;
    if (!score && nameNorm) {
      const nameTokens = nameNorm.split(" ").filter((t) => t.length > 2);
      const hit = nameTokens.filter((t) => m.includes(t)).length;
      if (hit >= 2) score += hit;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return bestScore > 0 ? best : null;
}

async function buildSubjectGradeSummary(req, message) {
  if (!looksLikeSubjectSummaryRequest(message)) return null;
  const students = await loadScopedStudents(req);
  if (!students.length) {
    return {
      answer: "I could not find uploaded student records in your current access scope.",
      links:
        req.user?.role === "admin"
          ? [{ to: "/admin/analysis-of-students", label: "Open Grade Band" }]
          : [{ to: "/faculty/upload", label: "Go to Upload" }],
    };
  }

  const subjectPick = pickRequestedSubject(message, students);
  if (!subjectPick) {
    return {
      answer:
        "I can summarize subject grades if you mention a subject code or name, e.g. 'summarize my subject grade for BSC12EC05'.",
      links:
        req.user?.role === "admin"
          ? [{ to: "/admin/analysis-of-students", label: "Open Grade Band" }]
          : [{ to: "/faculty/grade-bands", label: "Open Grade Bands" }],
    };
  }

  const grades = new Map();
  let total = 0;
  let pass = 0;
  let fail = 0;
  let pctSum = 0;
  let pctCount = 0;

  const targetCode = normalizeSubjectCode(subjectPick.code);
  const targetName = normalizeText(subjectPick.name);

  for (const s of students) {
    for (const sub of s.subjects || []) {
      const codeNorm = normalizeSubjectCode(sub?.code);
      const nameNorm = normalizeText(sub?.name);
      const codeMatch = targetCode && codeNorm === targetCode;
      const nameMatch = targetName && nameNorm === targetName;
      if (!codeMatch && !nameMatch) continue;

      total += 1;
      const g = normalizeGradeSymbol(sub?.grade) || "(blank)";
      grades.set(g, (grades.get(g) || 0) + 1);
      const outcome = classifyOutcome(sub?.result);
      if (outcome === "pass") pass += 1;
      else if (outcome === "fail") fail += 1;
      const pct = subjectTotalPercent(sub);
      if (pct != null && Number.isFinite(Number(pct))) {
        pctSum += Number(pct);
        pctCount += 1;
      }
    }
  }

  if (total === 0) {
    return {
      answer: `I found no grade rows for ${subjectPick.code || subjectPick.name} in your current scope.`,
      links:
        req.user?.role === "admin"
          ? [{ to: "/admin/analysis-of-students", label: "Open Grade Band" }]
          : [{ to: "/faculty/grade-bands", label: "Open Grade Bands" }],
    };
  }

  const topGrades = [...grades.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([g, c]) => `${g}:${c}`)
    .join(", ");
  const avgPct = pctCount ? (pctSum / pctCount).toFixed(2) : "N/A";
  const passRate = total ? ((pass / total) * 100).toFixed(1) : "0.0";
  const subjectLabel = subjectPick.code && subjectPick.name
    ? `${subjectPick.code} (${subjectPick.name})`
    : subjectPick.code || subjectPick.name || "Selected subject";

  return {
    answer:
      `Grade summary for ${subjectLabel}: total rows ${total}, pass ${pass}, fail ${fail}, pass rate ${passRate}%, average percentage ${avgPct}. ` +
      `Top grade counts: ${topGrades || "no grade symbols available"}.`,
    links:
      req.user?.role === "admin"
        ? [{ to: "/admin/analysis-of-students", label: "Open Grade Band" }]
        : [{ to: "/faculty/grade-bands", label: "Open Grade Bands" }],
  };
}

/**
 * GET /api/analytics/percentage-ranges?classLabel=&semester=
 * Distribution of overall student percentages in 5% buckets.
 */
export async function getOverallPercentageRanges(req, res, next) {
  try {
    const students = await loadScopedStudents(req);
    const buckets = Array.from({ length: 20 }, (_, i) => ({
      percentage: bucketLabel(i),
      count: 0,
    }));

    for (const s of students) {
      const pct =
        s?.percentage != null && Number.isFinite(Number(s.percentage))
          ? Number(s.percentage)
          : null;
      const idx = bucketIndexForPercentage(pct);
      if (idx === null) continue;
      buckets[idx].count += 1;
    }

    return res.json(buckets);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/dashboard?classLabel=&semester=
 */
export async function getDashboard(req, res, next) {
  try {
    const students = await loadScopedStudents(req);

    const totalStudents = students.length;

    const sgpaVals = students
      .map((s) => s.sgpa)
      .filter((n) => n !== undefined && n !== null && Number.isFinite(Number(n)))
      .map(Number);
    const avgSgpa = sgpaVals.length ? sgpaVals.reduce((a, b) => a + b, 0) / sgpaVals.length : null;

    let passCount = 0;
    let failCount = 0;
    for (const s of students) {
      const o = classifyOutcome(s.result);
      if (o === "pass") passCount += 1;
      else if (o === "fail") failCount += 1;
    }

    const passRate =
      totalStudents > 0 ? Math.round((passCount / totalStudents) * 1e6) / 1e6 : 0;

    /** @type {Record<string, number>} */
    const gradeDistribution = {};
    for (const s of students) {
      const subs = s.subjects;
      if (!Array.isArray(subs)) continue;
      for (const sub of subs) {
        const sym = normalizeGradeSymbol(sub.grade);
        const key = sym || "(blank)";
        gradeDistribution[key] = (gradeDistribution[key] ?? 0) + 1;
      }
    }

    /** @type {Map<string, { name: string, totals: number[] }>} */
    const bySubject = new Map();
    for (const s of students) {
      const subs = s.subjects;
      if (!Array.isArray(subs)) continue;
      for (const sub of subs) {
        const code = trimQuery(sub.code);
        const name =
          sub.name != null && String(sub.name).trim() !== ""
            ? String(sub.name).trim()
            : code || "Unknown";
        const pct = subjectTotalPercent(sub);
        if (pct == null || !Number.isFinite(pct)) continue;
        const key = code || "__NO_CODE__";
        let row = bySubject.get(key);
        if (!row) {
          row = { name, totals: [] };
          bySubject.set(key, row);
        } else if (row.name === "Unknown" && name !== "Unknown") {
          row.name = name;
        }
        row.totals.push(pct);
      }
    }

    const subjectAvgPercentage = Array.from(bySubject.entries())
      .map(([subjectCode, { name, totals }]) => ({
        subjectCode: subjectCode === "__NO_CODE__" ? "" : subjectCode,
        subjectName: name,
        avgPercentage:
          totals.length > 0
            ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 1e4) / 1e4
            : null,
      }))
      .sort((a, b) =>
        a.subjectCode.localeCompare(b.subjectCode, undefined, { sensitivity: "base" })
      );

    return res.json({
      totalStudents,
      avgSgpa,
      passCount,
      failCount,
      passRate,
      gradeDistribution,
      subjectAvgPercentage,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/grade-bands?classLabel=&subjectCode=
 */
export async function getGradeBands(req, res, next) {
  try {
    const students = await loadScopedStudents(req);
    const data = computeGradeBands(students);
    const codeFilter = trimQuery(req.query.subjectCode);
    if (!codeFilter) {
      return res.json(data);
    }
    const filtered = data.filter((d) => d.subjectCode === codeFilter);
    return res.json(filtered);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/bell-curve?classLabel=&subjectCode=&exam=ise|mse|ese|total
 */
export async function getBellCurve(req, res, next) {
  try {
    const subjectCode = trimQuery(req.query.subjectCode);
    if (!subjectCode) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Query parameter subjectCode is required.",
      });
    }

    const examRaw = trimQuery(req.query.exam).toLowerCase();
    const exam = examRaw || "total";
    if (!["ise", "mse", "ese", "total"].includes(exam)) {
      return res.status(400).json({
        error: "Bad Request",
        message: 'Query parameter exam must be one of: ise, mse, ese, total.',
      });
    }

    const students = await loadScopedStudents(req);

    const pickPct =
      exam === "ise"
        ? subjectIsePercent
        : exam === "mse"
          ? subjectMsePercent
        : exam === "ese"
          ? subjectEsePercent
          : subjectTotalPercent;

    const buckets = Array.from({ length: 20 }, (_, i) => ({
      percentage: bucketLabel(i),
      count: 0,
    }));

    for (const s of students) {
      const subs = s.subjects;
      if (!Array.isArray(subs)) continue;
      for (const sub of subs) {
        if (trimQuery(sub.code) !== subjectCode) continue;
        const pct = pickPct(sub);
        if (pct == null || !Number.isFinite(pct)) continue;
        const idx = bucketIndexForPercentage(pct);
        if (idx === null) continue;
        buckets[idx].count += 1;
      }
    }

    return res.json(buckets);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/subject-avg?classLabel=
 */
export async function getSubjectAvg(req, res, next) {
  try {
    const students = await loadScopedStudents(req);

    /** @type {Map<string, { name: string, internals: number[], externals: number[], totals: number[] }>} */
    const acc = new Map();

    for (const s of students) {
      const subs = s.subjects;
      if (!Array.isArray(subs)) continue;
      for (const sub of subs) {
        const code = trimQuery(sub.code);
        const name =
          sub.name != null && String(sub.name).trim() !== ""
            ? String(sub.name).trim()
            : code || "Unknown";
        const key = code || "__NO_CODE__";
        let row = acc.get(key);
        if (!row) {
          row = { name, internals: [], externals: [], totals: [] };
          acc.set(key, row);
        } else if (row.name === "Unknown" && name !== "Unknown") {
          row.name = name;
        }

        const i = sub.internal;
        const e = sub.external;
        const t = sub.total;
        if (i !== undefined && i !== null && i !== "" && Number.isFinite(Number(i))) {
          row.internals.push(Number(i));
        }
        if (e !== undefined && e !== null && e !== "" && Number.isFinite(Number(e))) {
          row.externals.push(Number(e));
        }
        if (t !== undefined && t !== null && t !== "" && Number.isFinite(Number(t))) {
          row.totals.push(Number(t));
        }
      }
    }

    const out = Array.from(acc.entries())
      .map(([subjectCode, { name, internals, externals, totals }]) => ({
        subjectCode: subjectCode === "__NO_CODE__" ? "" : subjectCode,
        subjectName: name,
        avgInternal: average(internals),
        avgExternal: average(externals),
        avgTotal: average(totals),
      }))
      .sort((a, b) =>
        a.subjectCode.localeCompare(b.subjectCode, undefined, { sensitivity: "base" })
      );

    return res.json(out);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/exam-progression?classLabel=
 * Ordered list suitable for charts: per-subject average ISE/MSE/ESE (percent for ISE/MSE/ESE).
 */
export async function getExamProgression(req, res, next) {
  try {
    const students = await loadScopedStudents(req);

    /** @type {Map<string, { name: string, ise: number[], mse: number[], ese: number[] }>} */
    const acc = new Map();

    for (const s of students) {
      const subs = s.subjects;
      if (!Array.isArray(subs)) continue;
      for (const sub of subs) {
        const code = trimQuery(sub.code);
        const name =
          sub.name != null && String(sub.name).trim() !== ""
            ? String(sub.name).trim()
            : code || "Unknown";
        const key = code || "__NO_CODE__";
        let row = acc.get(key);
        if (!row) {
          row = { name, ise: [], mse: [], ese: [] };
          acc.set(key, row);
        } else if (row.name === "Unknown" && name !== "Unknown") {
          row.name = name;
        }

        const ip = subjectIsePercent(sub);
        const mp = subjectMsePercent(sub);
        const ep = subjectEsePercent(sub);
        if (ip != null && Number.isFinite(ip)) row.ise.push(ip);
        if (mp != null && Number.isFinite(mp)) row.mse.push(mp);
        if (ep != null && Number.isFinite(ep)) row.ese.push(ep);
      }
    }

    const series = Array.from(acc.entries())
      .map(([subjectCode, { name, ise, mse, ese }]) => ({
        subjectCode: subjectCode === "__NO_CODE__" ? "" : subjectCode,
        subjectName: name,
        avgIse: average(ise),
        avgMse: mse.length ? average(mse) : null,
        avgEse: average(ese),
      }))
      .sort((a, b) =>
        a.subjectCode.localeCompare(b.subjectCode, undefined, { sensitivity: "base" })
      );

    return res.json(series);
  } catch (err) {
    next(err);
  }
}
/**
 * GET /api/analytics/upload-records?uploadId=
 * Used by Upload Page to show parsed table
 */
export async function getUploadRecords(req, res) {
  try {
    const { uploadId } = req.query;

    if (!uploadId) {
      return res.status(400).json({ message: "uploadId required" });
    }

    const students = await Student.find({ uploadId });

    return res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching records" });
  }
}

/**
 * GET /api/analytics/exam-updates
 * Published admin exam updates (read-only for authenticated users).
 */
export async function getExamUpdates(req, res, next) {
  try {
    const settings = await Settings.findById("app").lean();
    const updates = Array.isArray(settings?.examUpdates)
      ? settings.examUpdates
          .filter((u) => u?.published && String(u?.message || "").trim())
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      : [];
    return res.json({ updates });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/analytics/help-chat
 * Body: { message: string, history?: { role: "user"|"assistant", text: string }[] }
 */
export async function postHelpChat(req, res, next) {
  try {
    const message = trimQuery(req.body?.message);
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }

    const deterministicSummary = await buildSubjectGradeSummary(req, message);
    if (deterministicSummary) {
      return res.json(deterministicSummary);
    }

    const role = req.user?.role === "admin" ? "admin" : "faculty";
    const routes = websiteRouteContextForRole(role);
    const ollamaBase = trimQuery(process.env.OLLAMA_BASE_URL) || "http://127.0.0.1:11434";
    const preferredModel = trimQuery(process.env.OLLAMA_MODEL);
    const modelCandidates = preferredModel
      ? [preferredModel]
      : ["llama3.1:latest", "llama3.1:8b", "llama3:latest"];

    const systemPrompt = [
      "You are an in-app assistant for a College Examination Grading Analysis website.",
      "Answer only with guidance related to this website's features and workflows.",
      `Current user role: ${role}. Never suggest routes outside this role.`,
      "If asked non-website things, politely redirect to website usage help.",
      "Keep response concise and actionable.",
      "Return STRICT JSON only with shape:",
      '{"answer":"string","links":[{"to":"string","label":"string"}]}',
      "Use only these allowed links:",
      JSON.stringify(routes),
    ].join("\n");

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...history
        .slice(-8)
        .map((h) => ({
          role: h?.role === "assistant" ? "assistant" : "user",
          content: trimQuery(h?.text),
        }))
        .filter((h) => h.content),
      { role: "user", content: message },
    ];

    let modelText = "";
    let lastError = null;
    for (const modelName of modelCandidates) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const resp = await fetch(`${ollamaBase}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelName,
            messages: chatMessages,
            stream: false,
            options: { temperature: 0.2 },
          }),
          signal: controller.signal,
        });
        if (!resp.ok) {
          const text = await resp.text();
          lastError = new Error(`Ollama error ${resp.status}: ${text.slice(0, 200)}`);
          continue;
        }
        const data = await resp.json();
        modelText = trimQuery(data?.message?.content || data?.response || "");
        if (modelText) break;
      } catch (e) {
        lastError = e;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!modelText && lastError) throw lastError;

    let parsed = null;
    if (modelText) {
      try {
        parsed = JSON.parse(modelText);
      } catch {
        const m = modelText.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
          } catch {
            parsed = null;
          }
        }
      }
    }

    const answer =
      trimQuery(parsed?.answer) ||
      "I can help with navigation and usage of dashboard, upload, analytics, grade bands, and profile/faculty access.";
    const links = normalizeLinks(parsed?.links, role);
    return res.json({ answer, links });
  } catch (err) {
    if (err?.name === "AbortError") {
      return res.status(504).json({
        message:
          "Local Ollama did not respond in time. Ensure it is running (e.g. ollama serve).",
      });
    }
    next(err);
  }
}

