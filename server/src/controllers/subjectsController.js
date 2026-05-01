import { Subject } from "../models/Subject.js";
import { Settings } from "../models/Settings.js";

function toSemesterNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function getSubjectSemesters(_req, res, next) {
  try {
    let semesters = await Subject.distinct("semester");
    let normalized = semesters
      .map((s) => Number(s))
      .filter((s) => Number.isFinite(s))
      .sort((a, b) => a - b);

    // Backfill subjects collection from existing settings catalog if needed.
    if (normalized.length === 0) {
      const settings = await Settings.findById("app").lean();
      const catalog = Array.isArray(settings?.semesterSubjectCatalog)
        ? settings.semesterSubjectCatalog
        : [];
      const ops = [];
      for (const semRow of catalog) {
        const semester = Number(semRow?.semester);
        const subjects = Array.isArray(semRow?.subjects) ? semRow.subjects : [];
        for (const sub of subjects) {
          const subject_code = String(sub?.code || "")
            .trim()
            .toUpperCase();
          const subject_name = String(sub?.name || "").trim();
          if (!Number.isFinite(semester) || !subject_code || !subject_name) continue;
          ops.push({
            updateOne: {
              filter: { semester, subject_code },
              update: { $set: { semester, subject_code, subject_name } },
              upsert: true,
            },
          });
        }
      }
      if (ops.length) {
        await Subject.bulkWrite(ops, { ordered: false });
      }
      semesters = await Subject.distinct("semester");
      normalized = semesters
        .map((s) => Number(s))
        .filter((s) => Number.isFinite(s))
        .sort((a, b) => a - b);
    }

    return res.json(normalized);
  } catch (err) {
    next(err);
  }
}

export async function getSubjectsBySemester(req, res, next) {
  try {
    const semester = toSemesterNumber(req.query?.semester);
    if (semester == null) {
      return res.status(400).json({
        error: "Bad Request",
        message: "semester query param is required.",
      });
    }

    const subjects = await Subject.find({ semester })
      .select("subject_code subject_name -_id")
      .sort({ subject_code: 1 })
      .lean();
    return res.json(subjects);
  } catch (err) {
    next(err);
  }
}
