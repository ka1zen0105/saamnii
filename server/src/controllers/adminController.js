import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { Student } from "../models/Student.js";
import { Upload } from "../models/Upload.js";
import { User } from "../models/User.js";
import { Settings } from "../models/Settings.js";
import { SchoolClass } from "../models/SchoolClass.js";
import { SEMESTER_SUBJECT_CATALOG } from "../data/semesterSubjectCatalog.js";
import { SE_ECS_FACULTY } from "../data/seEcsFaculty.js";
import {
  computeGradeBands,
  subjectTotalPercent,
} from "../utils/gradeBandAnalysis.js";

function trim(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function dedupeSubjectCodes(codes) {
  return [...new Set((codes || []).map((c) => String(c).trim()).filter(Boolean))];
}

function normalizeSemesterAssignments(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      semester: Number(r?.semester),
      subjectCodes: dedupeSubjectCodes(r?.subjectCodes || []),
    }))
    .filter((r) => Number.isFinite(r.semester))
    .sort((a, b) => a.semester - b.semester);
}

function mergedSubjectCodesFromAssignments(assignments) {
  const merged = [];
  for (const row of assignments || []) {
    merged.push(...(row.subjectCodes || []));
  }
  return dedupeSubjectCodes(merged);
}

function avg(nums) {
  const a = nums.filter((n) => n != null && Number.isFinite(n));
  if (!a.length) return null;
  return a.reduce((x, y) => x + y, 0) / a.length;
}

function gradeFromPercentage(pct) {
  if (!Number.isFinite(Number(pct))) return "";
  const p = Number(pct);
  if (p >= 85) return "O";
  if (p >= 80) return "A";
  if (p >= 70) return "B";
  if (p >= 60) return "C";
  if (p >= 50) return "D";
  if (p >= 45) return "E";
  if (p >= 40) return "P";
  return "F";
}

function mentorUserId(row) {
  const email = trim(row?.email).toLowerCase();
  if (email) return email;
  const contact = trim(row?.contact);
  if (contact) return `mentor-${contact}`;
  return `mentor-${trim(row?.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

async function ensureMentorFacultyUsers() {
  if (!Array.isArray(SE_ECS_FACULTY) || SE_ECS_FACULTY.length === 0) return;
  const ops = SE_ECS_FACULTY.map((row) => {
    const userId = mentorUserId(row);
    return {
      updateOne: {
        filter: { userId, role: "faculty" },
        update: {
          $set: {
            role: "faculty",
            displayLabel: trim(row?.name),
            email: trim(row?.email).toLowerCase(),
            contact: trim(row?.contact),
          },
          $setOnInsert: {
            subjectCodes: [],
            semesterSubjectAssignments: [],
            assignedClasses: [],
          },
        },
        upsert: true,
      },
    };
  });
  await User.bulkWrite(ops);
}

function buildStudentQuery(req) {
  const classLabel = trim(req.query.classLabel);
  const subjectCode = trim(req.query.subjectCode);
  const facultyId = trim(req.query.facultyId);
  const semester = req.query.semester;
  /** @type {Record<string, unknown>} */
  const q = {};
  if (classLabel) q.classLabel = classLabel;
  if (semester !== undefined && semester !== "" && Number.isFinite(Number(semester))) {
    q.semester = Number(semester);
  }
  if (subjectCode) {
    q["subjects.code"] = subjectCode;
  }
  if (facultyId) {
    q.uploadId = { $in: [] };
  }
  return q;
}

async function applyFacultyScopeToQuery(q, req) {
  const facultyId = trim(req.query.facultyId);
  if (!facultyId) return q;
  const uploads = await Upload.find({ facultyId }).select("uploadId").lean();
  const uploadIds = uploads.map((u) => trim(u?.uploadId)).filter(Boolean);
  q.uploadId = uploadIds.length ? { $in: uploadIds } : { $in: [] };
  return q;
}

/**
 * GET /api/admin/dashboard
 */
export async function getAdminDashboard(req, res, next) {
  try {
    const q = await applyFacultyScopeToQuery(buildStudentQuery(req), req);
    const subjectCodeFilter = trim(req.query.subjectCode);
    const [totalStudents, settings] = await Promise.all([
      Student.countDocuments(q),
      Settings.findById("app").lean(),
    ]);

    const students = await Student.find(q).lean();
    let recordRows = 0;
    const subjectKeySet = new Set();
    for (const s of students) {
      const subs = s.subjects || [];
      recordRows += subs.length;
      for (const sub of subs) {
        const c = trim(sub.code);
        if (c) subjectKeySet.add(c);
      }
    }
    const subjectsCount = subjectKeySet.size;
    let passCount = 0;
    let failCount = 0;
    const gradeDistribution = {};
    const sgpaVals = [];

    for (const s of students) {
      const r = String(s.result ?? "").toLowerCase();
      if (/fail|withheld|absent/.test(r)) failCount += 1;
      else if (/pass|successful|complete|dist|first/.test(r)) passCount += 1;
      if (s.sgpa != null && Number.isFinite(Number(s.sgpa))) {
        sgpaVals.push(Number(s.sgpa));
      }
      if (subjectCodeFilter) {
        const subs = (s.subjects || []).filter((sub) => trim(sub?.code) === subjectCodeFilter);
        for (const sub of subs) {
          const g = gradeFromPercentage(subjectTotalPercent(sub)) || "(blank)";
          gradeDistribution[g] = (gradeDistribution[g] ?? 0) + 1;
        }
      } else {
        const g = gradeFromPercentage(s.percentage) || "(blank)";
        gradeDistribution[g] = (gradeDistribution[g] ?? 0) + 1;
      }
    }

    const n = students.length;
    const passPct = n > 0 ? Math.round((passCount / n) * 10000) / 100 : 0;
    const avgSgpa = avg(sgpaVals);

    const passFailBySubject = computePassFailBySubject(students);

    const uploads = await Upload.find().sort({ createdAt: 1 }).lean();
    const performanceTrend = [];
    for (let i = 0; i < uploads.length; i += 1) {
      const u = uploads[i];
      const group = await Student.aggregate([
        { $match: { uploadId: u.uploadId } },
        { $group: { _id: null, avgSgpa: { $avg: "$sgpa" } } },
      ]);
      performanceTrend.push({
        uploadId: u.uploadId,
        label: `Batch ${i + 1}`,
        avgSgpa:
          group[0]?.avgSgpa != null
            ? Math.round(Number(group[0].avgSgpa) * 1000) / 1000
            : null,
        createdAt: u.createdAt,
      });
    }

    const publishedUpdates = Array.isArray(settings?.examUpdates)
      ? settings.examUpdates
          .filter((u) => u?.published && String(u?.message || "").trim())
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
          .slice(0, 10)
      : [];

    return res.json({
      stats: {
        totalStudents,
        recordRows,
        subjectsCount,
        failCount,
        passPct,
        avgSgpa: avgSgpa != null ? Math.round(avgSgpa * 1000) / 1000 : null,
      },
      gradeDistribution,
      passFailBySubject,
      performanceTrend,
      publishResults: Boolean(settings?.publishResults),
      examUpdates: publishedUpdates,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/exam-updates
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
 * POST /api/admin/exam-updates
 * Body: { message: string }
 */
export async function createExamUpdate(req, res, next) {
  try {
    const message = trim(req.body?.message);
    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }

    const nextUpdate = {
      message,
      published: true,
      createdAt: new Date(),
      createdBy: trim(req.user?.userId) || "admin",
    };

    const doc = await Settings.findByIdAndUpdate(
      "app",
      { $push: { examUpdates: { $each: [nextUpdate], $slice: -100 } } },
      { new: true, upsert: true }
    ).lean();

    const updates = Array.isArray(doc?.examUpdates)
      ? doc.examUpdates
          .filter((u) => u?.published && String(u?.message || "").trim())
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      : [];

    return res.status(201).json({ ok: true, updates });
  } catch (err) {
    next(err);
  }
}

function computePassFailBySubject(students) {
  /** @type {Map<string, { subjectCode: string, subjectName: string, pass: number, fail: number }>} */
  const map = new Map();
  for (const s of students) {
    for (const sub of s.subjects || []) {
      const code = trim(sub.code);
      const name = trim(sub.name) || code || "Unknown";
      const key = code || name;
      if (!map.has(key)) {
        map.set(key, { subjectCode: code, subjectName: name, pass: 0, fail: 0 });
      }
      const row = map.get(key);
      const r = String(sub.result ?? "").toLowerCase();
      if (/fail|withheld|absent|ft/.test(r)) row.fail += 1;
      else if (/pass|successful|complete|dist|sat/.test(r)) row.pass += 1;
    }
  }
  return [...map.values()].sort((a, b) =>
    a.subjectCode.localeCompare(b.subjectCode, undefined, { sensitivity: "base" })
  );
}

/**
 * GET /api/admin/settings
 */
export async function getSettings(req, res, next) {
  try {
    let doc = await Settings.findById("app").lean();
    if (!doc) {
      await Settings.create({ _id: "app", publishResults: false });
      doc = { publishResults: false };
    }
    return res.json({ publishResults: Boolean(doc.publishResults) });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/settings  { publishResults: boolean }
 */
export async function patchSettings(req, res, next) {
  try {
    const pr = req.body?.publishResults;
    if (typeof pr !== "boolean") {
      return res.status(400).json({ message: "publishResults boolean required" });
    }
    await Settings.findByIdAndUpdate(
      "app",
      { publishResults: pr },
      { upsert: true, new: true }
    );
    return res.json({ publishResults: pr });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/review-rows?classLabel=&subjectCode=
 */
export async function getReviewRows(req, res, next) {
  try {
    const q = await applyFacultyScopeToQuery(buildStudentQuery(req), req);
    const students = await Student.find(q).lean();
    const rows = [];
    for (const s of students) {
      const subs = s.subjects || [];
      for (let i = 0; i < subs.length; i += 1) {
        const sub = subs[i];
        const pct = subjectTotalPercent(sub);
        rows.push({
          id: `${s._id.toString()}:${i}`,
          studentId: s._id.toString(),
          subIndex: i,
          name: s.name ?? "",
          roll: s.prn ?? "",
          classLabel: s.classLabel ?? "",
          subject: sub.name ?? sub.code ?? "",
          subjectCode: sub.code ?? "",
          total: sub.total ?? null,
          percentage: pct != null ? Math.round(pct * 10000) / 10000 : null,
          grade: sub.grade ?? "",
          passFail: sub.result ?? "",
        });
      }
    }
    return res.json({ rows });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/students/marks
 * Header: X-Confirm-Phrase: DELETE_ALL_MARKS
 */
export async function deleteAllMarks(req, res, next) {
  try {
    const phrase = req.headers["x-confirm-phrase"];
    if (phrase !== "DELETE_ALL_MARKS") {
      return res.status(400).json({
        message: "Send header X-Confirm-Phrase: DELETE_ALL_MARKS",
      });
    }
    const r = await Student.deleteMany({});
    await Upload.deleteMany({});
    return res.json({ ok: true, deletedStudents: r.deletedCount });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/grade-bands-pooled?classLabel=
 */
export async function getGradeBandsPooled(req, res, next) {
  try {
    const q = await applyFacultyScopeToQuery(buildStudentQuery(req), req);
    const students = await Student.find(q).lean();
    const perSubject = computeGradeBands(students);
    if (!perSubject.length) {
      return res.json({ pooledBands: [], perSubject: [] });
    }
    const template = perSubject[0].bands.map((b) => ({
      label: b.label,
      gradeSymbol: b.gradeSymbol,
      ise: 0,
      mse: 0,
      ese: 0,
      total: 0,
    }));
    for (const sub of perSubject) {
      sub.bands.forEach((b, i) => {
        template[i].ise += b.ise;
        template[i].mse += b.mse;
        template[i].ese += b.ese;
        template[i].total += b.total;
      });
    }
    return res.json({ pooledBands: template, perSubject });
  } catch (err) {
    next(err);
  }
}

function computePooledBandsInline(students) {
  const perSubject = computeGradeBands(students);
  if (!perSubject.length) return [];
  const template = perSubject[0].bands.map((b) => ({
    label: b.label,
    gradeSymbol: b.gradeSymbol,
    ise: 0,
    mse: 0,
    ese: 0,
    total: 0,
  }));
  for (const sub of perSubject) {
    sub.bands.forEach((b, i) => {
      template[i].ise += b.ise;
      template[i].mse += b.mse;
      template[i].ese += b.ese;
      template[i].total += b.total;
    });
  }
  return template;
}

/**
 * GET /api/admin/grade-bands-xlsx?classLabel=&subjectCode=
 */
export async function getGradeBandsXlsx(req, res, next) {
  try {
    const q = await applyFacultyScopeToQuery(buildStudentQuery(req), req);
    const students = await Student.find(q).lean();
    const perSubject = computeGradeBands(students);
    const pooledBands = computePooledBandsInline(students);
    const wb = XLSX.utils.book_new();

    if (pooledBands.length) {
      const ws = XLSX.utils.json_to_sheet(
        pooledBands.map((b) => ({
          Band: b.label,
          Symbol: b.gradeSymbol,
          ISE: b.ise,
          MSE: b.mse,
          ESE: b.ese,
          Total: b.total,
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws, "Pooled");
    }

    for (const sub of perSubject) {
      const name = (sub.subjectCode || sub.subjectName || "S").slice(0, 28);
      const ws = XLSX.utils.json_to_sheet(
        sub.bands.map((b) => ({
          Band: b.label,
          Symbol: b.gradeSymbol,
          ISE: b.ise,
          MSE: b.mse,
          ESE: b.ese,
          Total: b.total,
        }))
      );
      XLSX.utils.book_append_sheet(wb, ws, name.replace(/[*?:/\\[\]]/g, "_"));
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="grade-bands.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return res.send(Buffer.from(buf));
  } catch (err) {
    next(err);
  }
}

export async function getAdminMeta(req, res, next) {
  try {
    const q = await applyFacultyScopeToQuery({}, req);
    const classes = await Student.distinct("classLabel", q);
    const subjectCodes = await Student.distinct("subjects.code", q);
    return res.json({
      classes: classes.filter(Boolean).sort(),
      subjectCodes: subjectCodes.filter(Boolean).sort(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/faculty-o-grade-distribution?classLabel=&semester=&subjectCode=
 * Returns faculty-wise O-grade percentage in current class/semester/subject scope.
 */
export async function getFacultyOGradeDistribution(req, res, next) {
  try {
    const classLabel = trim(req.query.classLabel);
    const subjectCode = trim(req.query.subjectCode);
    const semesterRaw = req.query.semester;
    const semester =
      semesterRaw !== undefined && semesterRaw !== "" && Number.isFinite(Number(semesterRaw))
        ? Number(semesterRaw)
        : undefined;

    const studentMatch = {};
    if (classLabel) studentMatch.classLabel = classLabel;
    if (semester !== undefined) studentMatch.semester = semester;

    const pipeline = [
      { $match: studentMatch },
      { $unwind: "$subjects" },
      ...(subjectCode ? [{ $match: { "subjects.code": subjectCode } }] : []),
      {
        $lookup: {
          from: "uploads",
          localField: "uploadId",
          foreignField: "uploadId",
          as: "upload",
        },
      },
      { $unwind: "$upload" },
      {
        $group: {
          _id: "$upload.facultyId",
          total: { $sum: 1 },
          oCount: {
            $sum: {
              $cond: [
                {
                  $regexMatch: {
                    input: { $toUpper: { $trim: { input: { $ifNull: ["$subjects.grade", ""] } } } },
                    regex: "^O$",
                  },
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          facultyId: "$_id",
          total: 1,
          oCount: 1,
          oPercentage: {
            $cond: [
              { $gt: ["$total", 0] },
              { $multiply: [{ $divide: ["$oCount", "$total"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { oPercentage: -1 } },
    ];

    const rows = await Student.aggregate(pipeline);
    const facultyIds = rows.map((r) => r.facultyId).filter(Boolean);
    const users = facultyIds.length
      ? await User.find({ role: "faculty", userId: { $in: facultyIds } })
          .select("userId displayLabel")
          .lean()
      : [];
    const labelByUserId = new Map(
      users.map((u) => [u.userId, u.displayLabel || u.userId])
    );

    const distribution = rows.map((r) => ({
      facultyId: r.facultyId,
      facultyLabel: labelByUserId.get(r.facultyId) || r.facultyId,
      total: r.total,
      oCount: r.oCount,
      oPercentage: Math.round(Number(r.oPercentage || 0) * 100) / 100,
    }));

    return res.json({ distribution });
  } catch (err) {
    next(err);
  }
}

export async function getSemesterSubjectCatalog(_req, res) {
  return res.json({ semesters: SEMESTER_SUBJECT_CATALOG });
}

export async function patchFacultyClasses(req, res, next) {
  try {
    const { userId } = req.params;
    const arr = req.body?.assignedClasses;
    if (!Array.isArray(arr)) {
      return res.status(400).json({ message: "assignedClasses array required" });
    }
    const clean = arr.map((c) => String(c).trim()).filter(Boolean);
    const u = await User.findOneAndUpdate(
      { userId: userId?.trim(), role: "faculty" },
      { assignedClasses: clean },
      { new: true }
    ).lean();
    if (!u) return res.status(404).json({ message: "Faculty not found" });
    return res.json(u);
  } catch (err) {
    next(err);
  }
}

export async function listFaculty(req, res, next) {
  try {
    await ensureMentorFacultyUsers();
    const users = await User.find({ role: "faculty" })
      .select(
        "userId displayLabel email contact subjectCodes semesterSubjectAssignments assignedClasses"
      )
      .lean();
    return res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function createFaculty(req, res, next) {
  try {
    const { userId, displayLabel, email, contact, password } = req.body ?? {};
    if (!userId || typeof userId !== "string" || !userId.trim()) {
      return res.status(400).json({ message: "userId required" });
    }
    if (
      password === undefined ||
      password === null ||
      typeof password !== "string" ||
      password.length < 6
    ) {
      return res.status(400).json({ message: "password required (at least 6 characters)" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const u = await User.create({
      userId: userId.trim(),
      displayLabel: displayLabel ? String(displayLabel).trim() : "",
      email: email != null && String(email).trim() ? String(email).trim().toLowerCase() : "",
      contact: contact != null ? String(contact).trim() : "",
      role: "faculty",
      passwordHash,
      subjectCodes: [],
      semesterSubjectAssignments: [],
      assignedClasses: [],
    });
    return res.status(201).json({
      userId: u.userId,
      displayLabel: u.displayLabel,
      email: u.email,
      contact: u.contact,
      subjectCodes: u.subjectCodes,
      semesterSubjectAssignments: u.semesterSubjectAssignments,
      assignedClasses: u.assignedClasses,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "User id already exists" });
    }
    next(err);
  }
}

export async function patchFacultySubjects(req, res, next) {
  try {
    const { userId } = req.params;
    const codes = req.body?.subjectCodes;
    if (!Array.isArray(codes)) {
      return res.status(400).json({ message: "subjectCodes array required" });
    }
    const clean = codes.map((c) => String(c).trim()).filter(Boolean);
    const u = await User.findOneAndUpdate(
      { userId: userId?.trim(), role: "faculty" },
      { subjectCodes: clean },
      { new: true }
    ).lean();
    if (!u) return res.status(404).json({ message: "Faculty not found" });
    return res.json(u);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/faculty/:userId/semester-subjects
 * Body: { semester: number, subjectCodes: string[] }
 */
export async function patchFacultySemesterSubjects(req, res, next) {
  try {
    const { userId } = req.params;
    const sem = Number(req.body?.semester);
    const codes = req.body?.subjectCodes;
    if (!Number.isFinite(sem)) {
      return res.status(400).json({ message: "semester number required" });
    }
    if (!Array.isArray(codes)) {
      return res.status(400).json({ message: "subjectCodes array required" });
    }
    const clean = dedupeSubjectCodes(codes);

    const user = await User.findOne({ userId: userId?.trim(), role: "faculty" }).lean();
    if (!user) return res.status(404).json({ message: "Faculty not found" });

    const current = normalizeSemesterAssignments(user.semesterSubjectAssignments || []);
    const next = current.filter((r) => r.semester !== sem);
    next.push({ semester: sem, subjectCodes: clean });
    const normalized = normalizeSemesterAssignments(next);
    const mergedCodes = mergedSubjectCodesFromAssignments(normalized);

    const updated = await User.findOneAndUpdate(
      { userId: userId?.trim(), role: "faculty" },
      {
        semesterSubjectAssignments: normalized,
        subjectCodes: mergedCodes,
      },
      { new: true }
    ).lean();

    return res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function listClasses(req, res, next) {
  try {
    const list = await SchoolClass.find().sort({ classLabel: 1 }).lean();
    return res.json(list);
  } catch (err) {
    next(err);
  }
}

export async function listFacultyUploads(req, res, next) {
  try {
    const userId = trim(req.params?.userId);
    if (!userId) {
      return res.status(400).json({ message: "userId required" });
    }
    const uploads = await Upload.find({ facultyId: userId })
      .select("uploadId classLabel createdAt rowCount")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ uploads });
  } catch (err) {
    next(err);
  }
}

export async function createClass(req, res, next) {
  try {
    const { classLabel, teacherUserId } = req.body ?? {};
    if (!classLabel || typeof classLabel !== "string") {
      return res.status(400).json({ message: "classLabel required" });
    }
    const doc = await SchoolClass.create({
      classLabel: classLabel.trim(),
      teacherUserId: teacherUserId ? String(teacherUserId).trim() : "",
      curriculum: [],
    });
    return res.status(201).json(doc);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Class already exists" });
    }
    next(err);
  }
}

export async function patchClassTeacher(req, res, next) {
  try {
    const label = decodeURIComponent(req.params.classLabel || "").trim();
    const { teacherUserId } = req.body ?? {};
    const doc = await SchoolClass.findOneAndUpdate(
      { classLabel: label },
      { teacherUserId: teacherUserId != null ? String(teacherUserId).trim() : "" },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: "Class not found" });
    return res.json(doc);
  } catch (err) {
    next(err);
  }
}

export async function patchClassCurriculum(req, res, next) {
  try {
    const label = decodeURIComponent(req.params.classLabel || "").trim();
    const raw = req.body?.subjectsText ?? req.body?.curriculum;
    let lines = [];
    if (typeof raw === "string") {
      lines = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    } else if (Array.isArray(raw)) {
      lines = raw.map((l) => String(l).trim()).filter(Boolean);
    }
    const doc = await SchoolClass.findOneAndUpdate(
      { classLabel: label },
      { curriculum: lines },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: "Class not found" });
    return res.json(doc);
  } catch (err) {
    next(err);
  }
}
