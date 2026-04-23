import { Student, Upload } from "../models/index.js";
import { subjectTotalPercent } from "../utils/gradeBandAnalysis.js";
import { formatIdentifier } from "../utils/excelRowMap.js";

function classifyOutcome(resultRaw) {
  const s = String(resultRaw ?? "").trim();
  if (!s) return "unknown";
  if (/fail|f\.?\s*t\.?|withheld|absent|disc(?:ontinued)?/iu.test(s)) return "fail";
  if (/pass|successful|complete|first\s*class|dist(?:inction)?|sat|cleared/iu.test(s)) {
    return "pass";
  }
  return "unknown";
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

function trimStr(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function allowedSubjectSet(req) {
  const list = Array.isArray(req.user?.subjectCodes) ? req.user.subjectCodes : [];
  return new Set(list.map((c) => trimStr(c)).filter(Boolean));
}

function filterSubjectsByRole(req, subjects) {
  const subs = Array.isArray(subjects) ? subjects : [];
  if (req.user?.role !== "faculty") return subs;
  const allow = allowedSubjectSet(req);
  // Empty subjectCodes means no restriction (e.g. email-based mentor login).
  if (allow.size === 0) return subs;
  return subs.filter((sub) => allow.has(trimStr(sub?.code)));
}

async function getUploadWithAccess(req, uploadId) {
  const doc = await Upload.findOne({ uploadId })
    .select("+fileBuffer fileMimeType originalFileName fileSizeBytes facultyId")
    .lean();
  if (!doc) return { error: { status: 404, message: "Upload not found." } };

  const role = req.user?.role;
  if (role === "faculty" && doc.facultyId !== req.user?.userId) {
    return { error: { status: 403, message: "You do not have access to this upload." } };
  }
  if (role !== "faculty" && role !== "admin") {
    return { error: { status: 403, message: "You do not have access to this upload." } };
  }
  return { doc };
}

/**
 * GET /api/upload/:uploadId/records — faculty owner only.
 */
export async function getUploadRecords(req, res, next) {
  try {
    const raw = req.params.uploadId;
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "uploadId is required.",
      });
    }

    const uploadId = raw.trim();
    const { error } = await getUploadWithAccess(req, uploadId);
    if (error) {
      return res.status(error.status).json({
        error: error.status === 404 ? "Not Found" : "Forbidden",
        message: error.message,
      });
    }

    const students = await Student.find({ uploadId }).lean();
    const rows = [];

    for (const s of students) {
      const subs = filterSubjectsByRole(req, s.subjects);
      if (!Array.isArray(subs)) continue;
      for (const sub of subs) {
        const pct = subjectTotalPercent(sub);
        rows.push({
          name: s.name ?? "",
          roll: formatIdentifier(s.prn ?? s.seatNo ?? ""),
          semester: s.semester ?? null,
          classLabel: s.classLabel ?? "",
          subject: sub.name ?? sub.code ?? "",
          subjectCode: sub.code ?? "",
          ise1: sub.internal ?? null,
          ise2: sub.ise2 ?? null,
          mse: sub.mse ?? null,
          ese: sub.external ?? null,
          total: sub.total ?? null,
          percentage: pct != null ? Math.round(pct * 10_000) / 10_000 : null,
          grade: sub.grade ?? "",
          passFail: sub.result ?? "",
        });
      }
    }

    return res.json({ uploadId, rowCount: rows.length, rows });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/upload/:uploadId/file
 * - Faculty can download only their own upload.
 * - Admin can download any upload.
 */
export async function downloadUploadFile(req, res, next) {
  try {
    const raw = req.params.uploadId;
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "uploadId is required.",
      });
    }

    const uploadId = raw.trim();
    const { doc, error } = await getUploadWithAccess(req, uploadId);
    if (error) {
      return res.status(error.status).json({
        error: error.status === 404 ? "Not Found" : "Forbidden",
        message: error.message,
      });
    }

    if (!doc.fileBuffer || !Buffer.isBuffer(doc.fileBuffer)) {
      return res.status(404).json({
        error: "Not Found",
        message: "Original file is not available for this upload.",
      });
    }

    const fallbackName = `${uploadId}.xlsx`;
    const originalName = String(doc.originalFileName || fallbackName).replace(
      /[^\w.\- ]/g,
      "_"
    );
    const mime =
      doc.fileMimeType ||
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(doc.fileSizeBytes || doc.fileBuffer.length));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${originalName || fallbackName}"`
    );
    return res.send(doc.fileBuffer);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/upload/my-uploads
 * Returns faculty-owned uploads ordered latest first.
 */
export async function getMyUploads(req, res, next) {
  try {
    const role = req.user?.role;
    if (role !== "faculty") {
      return res.status(403).json({
        error: "Forbidden",
        message: "Only faculty can list their uploads.",
      });
    }
    const facultyId = req.user?.userId;
    const uploads = await Upload.find({ facultyId })
      .select("uploadId classLabel semester examMonth examYear branch rowCount createdAt originalFileName")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ uploads });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/upload/:uploadId/analytics
 * Upload-scoped analytics for charts on upload page.
 */
export async function getUploadAnalytics(req, res, next) {
  try {
    const raw = req.params.uploadId;
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "uploadId is required.",
      });
    }
    const uploadId = raw.trim();
    const { error } = await getUploadWithAccess(req, uploadId);
    if (error) {
      return res.status(error.status).json({
        error: error.status === 404 ? "Not Found" : "Forbidden",
        message: error.message,
      });
    }

    const students = await Student.find({ uploadId }).lean();
    const gradeDistribution = {};
    const percentageRanges = Array.from({ length: 20 }, (_, i) => ({
      percentage: bucketLabel(i),
      count: 0,
    }));
    const passFailBySubject = new Map();

    let scopedStudentCount = 0;
    for (const s of students) {
      const subs = filterSubjectsByRole(req, s.subjects);
      if (!subs.length) continue;
      scopedStudentCount += 1;
      const idx = bucketIndexForPercentage(
        s?.percentage != null && Number.isFinite(Number(s.percentage))
          ? Number(s.percentage)
          : null
      );
      if (idx != null) percentageRanges[idx].count += 1;

      for (const sub of subs) {
        const g = String(sub?.grade ?? "").trim().toUpperCase() || "(blank)";
        gradeDistribution[g] = (gradeDistribution[g] ?? 0) + 1;

        const code = String(sub?.code ?? "").trim();
        const name = String(sub?.name ?? "").trim() || code || "Unknown";
        const key = code || name;
        if (!passFailBySubject.has(key)) {
          passFailBySubject.set(key, {
            subjectCode: code,
            subjectName: name,
            pass: 0,
            fail: 0,
          });
        }
        const row = passFailBySubject.get(key);
        const outcome = classifyOutcome(sub?.result);
        if (outcome === "pass") row.pass += 1;
        else if (outcome === "fail") row.fail += 1;
      }
    }

    return res.json({
      uploadId,
      totalStudents: scopedStudentCount,
      gradeDistribution,
      percentageRanges,
      passFailBySubject: [...passFailBySubject.values()],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/upload/:uploadId
 * Faculty can delete only own upload data; admin can delete any upload.
 */
export async function deleteUpload(req, res, next) {
  try {
    const raw = req.params.uploadId;
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({
        error: "Bad Request",
        message: "uploadId is required.",
      });
    }
    const uploadId = raw.trim();
    const { error } = await getUploadWithAccess(req, uploadId);
    if (error) {
      return res.status(error.status).json({
        error: error.status === 404 ? "Not Found" : "Forbidden",
        message: error.message,
      });
    }
    await Promise.all([Upload.deleteOne({ uploadId }), Student.deleteMany({ uploadId })]);
    return res.json({ ok: true, uploadId });
  } catch (err) {
    next(err);
  }
}
