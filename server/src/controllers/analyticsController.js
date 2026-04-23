import { Student, Upload } from "../models/index.js";
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

