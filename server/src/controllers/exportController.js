import * as XLSX from "xlsx";
import { Student } from "../models/Student.js";
import { computeGradeBands } from "../utils/gradeBandAnalysis.js";

function trim(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

/**
 * Query filter for export: optional classLabel and subjectCode on embedded subjects.
 * @param {import("express").Request} req
 */
function buildExportStudentQuery(req) {
  const classLabel = trim(req.query.classLabel);
  const subjectCode = trim(req.query.subjectCode);
  /** @type {Record<string, unknown>} */
  const q = {};
  if (classLabel) q.classLabel = classLabel;
  if (subjectCode) {
    q["subjects.code"] = subjectCode;
  }
  return q;
}

const SHEET_NAME_MAX = 31;
const INVALID_SHEET_CHARS = /[*?:/\\[\]]/g;

function safeSheetName(raw) {
  const s = (raw || "Subject").slice(0, SHEET_NAME_MAX).replace(INVALID_SHEET_CHARS, "_");
  return s || "Subject";
}

/**
 * GET /api/export/grade-bands-xlsx?classLabel=&subjectCode=
 * One sheet per subject; Analysis layout: header row (subject name), then Grade | ISE | MSE | ESE | Total,
 * then one row per band (O … F).
 */
export async function getGradeBandsXlsx(req, res, next) {
  try {
    const q = buildExportStudentQuery(req);
    const students = await Student.find(q).lean();
    const perSubject = computeGradeBands(students);

    const wb = XLSX.utils.book_new();

    if (perSubject.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([
        ["No subjects match this filter."],
        [],
        ["Grade", "ISE", "MSE", "ESE", "Total"],
      ]);
      ws["!cols"] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws, "Export");
    } else {
      for (const sub of perSubject) {
        const title =
          sub.subjectCode && sub.subjectName
            ? `${sub.subjectCode} — ${sub.subjectName}`
            : sub.subjectName || sub.subjectCode || "Subject";

        /** @type {(string | number)[][]} */
        const aoa = [];
        aoa.push([title]);
        aoa.push(["Grade", "ISE", "MSE", "ESE", "Total"]);
        for (const b of sub.bands) {
          aoa.push([b.gradeSymbol, b.ise, b.mse, b.ese, b.total]);
        }

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
        ws["!cols"] = [
          { wch: 14 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 12 },
        ];

        const sheetName = safeSheetName(sub.subjectCode || sub.subjectName);
        let name = sheetName;
        let n = 1;
        while (wb.SheetNames.includes(name)) {
          const suffix = `_${n}`;
          name = safeSheetName((sub.subjectCode || sub.subjectName) + suffix);
          n += 1;
        }
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
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
