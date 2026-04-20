import * as XLSX from "xlsx";
import mongoose from "mongoose";
import { Student, Upload } from "../models/index.js";
import {
  formatIdentifier,
  getCell,
  getSubjectCell,
  normalizeHeaderKey,
} from "../utils/excelRowMap.js";

function trimStr(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).trim().replace(/%$/u, "");
  if (s === "") return undefined;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  const digits = s.match(/\d+/u);
  if (digits) {
    const nd = Number(digits[0]);
    if (Number.isFinite(nd)) return nd;
  }
  return undefined;
}

function parseNumberLoose(value) {
  if (value === undefined || value === null || value === "" || value === "-") {
    return undefined;
  }
  return parseNumber(value);
}

function deriveClassLabel(branch, semester) {
  const b = trimStr(branch).toUpperCase().replace(/\s+/gu, "");
  const sem = parseNumber(semester);
  if (!b || sem === undefined) return "";
  return `${b}-SEM${sem}`;
}

function buildSubjectsFromRow(row) {
  const subjects = [];
  for (let i = 1; i <= 15; i += 1) {
    const name = trimStr(getSubjectCell(row, i, "NM"));
    if (!name) continue;
    subjects.push({
      code: trimStr(getSubjectCell(row, i, "CD")),
      name,
      internal: parseNumber(getSubjectCell(row, i, "IA")),
      ise2: parseNumber(getSubjectCell(row, i, "IA2")),
      mse: parseNumber(getSubjectCell(row, i, "MSE")),
      external: parseNumber(getSubjectCell(row, i, "ESE")),
      total: parseNumber(getSubjectCell(row, i, "TOT")),
      grade: trimStr(getSubjectCell(row, i, "GR")),
      credits: parseNumber(getSubjectCell(row, i, "CR")),
      result: trimStr(getSubjectCell(row, i, "R")),
    });
  }
  return subjects;
}

function mapRowToStudent(row, { uploadId, classLabel }) {
  const semester = parseNumber(
    getCell(row, "SEM", "SEMESTER", "SEM NO", "SEMNO", "TERM")
  );
  const branch = trimStr(
    getCell(
      row,
      "BRANCH",
      "DEPT",
      "DEPARTMENT",
      "PROGRAM",
      "STREAM",
      "SPECIALIZATION_MAJOR",
      "COURSE_CODE"
    )
  );
  const examMonth = trimStr(getCell(row, "MONTH", "MON", "EXAM MONTH"));
  const examYear = parseNumber(getCell(row, "YEAR", "EXAM YEAR", "YR"));

  return {
    name: trimStr(
      getCell(
        row,
        "NAME",
        "STUDENT NAME",
        "STUDENTNAME",
        "CANDIDATE NAME",
        "NAME OF THE STUDENT",
        "STUDENT"
      )
    ),
    prn: formatIdentifier(
      getCell(row, "PRN", "USN", "ROLL", "ROLL NO", "ROLLNO", "ENROLLMENT NO", "REG NO", "REGNO")
    ),
    seatNo: trimStr(getCell(row, "SEAT NO", "SEATNO", "SEAT", "SEAT NUMBER")),
    semester,
    examMonth,
    examYear,
    branch,
    sgpa: parseNumber(getCell(row, "SGPA", "S.GPA")),
    cgpa: parseNumber(getCell(row, "CGPA", "C.GPA")),
    totalMarks: parseNumber(
      getCell(row, "TOTAL", "TOTAL MARKS", "GRAND TOTAL", "TOT_MRKS")
    ),
    percentage: parseNumber(
      getCell(row, "PERCENTAGE", "PERCENT", "AGGREGATE %", "%", "PERCENTAGE OF MARKS")
    ),
    result: trimStr(getCell(row, "RESULT", "OVERALL RESULT", "STATUS")),
    uploadId,
    classLabel,
    subjects: buildSubjectsFromRow(row),
  };
}

function isRowEmpty(row) {
  const name = trimStr(
    getCell(
      row,
      "NAME",
      "STUDENT NAME",
      "STUDENTNAME",
      "CANDIDATE NAME",
      "NAME OF THE STUDENT"
    )
  );
  const prn = formatIdentifier(
    getCell(row, "PRN", "USN", "ROLL", "ROLL NO", "ROLLNO", "ENROLLMENT NO", "REG NO")
  );
  return !name && !prn;
}

const REQUIRED_DETAILED_RESULT_HEADERS = [
  "NAME OF THE STUDENT",
  "PRN",
  "SEM",
  "PERCENT",
  "RESULT",
  "SUB1NM",
  "SUB1",
];

function validateMandatoryDetailedResultHeaders(rows) {
  const firstRow = rows?.[0];
  if (!firstRow || typeof firstRow !== "object") {
    return { ok: false, missing: REQUIRED_DETAILED_RESULT_HEADERS };
  }
  const available = new Set(
    Object.keys(firstRow).map((k) => normalizeHeaderKey(k))
  );
  const missing = REQUIRED_DETAILED_RESULT_HEADERS.filter(
    (h) => !available.has(normalizeHeaderKey(h))
  );
  return { ok: missing.length === 0, missing };
}

function normalizeText(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function isContineoMatrixHeaderRow(row) {
  const need = ["SLNO", "USN", "ROLLNO", "NAME"];
  const got = new Set((Array.isArray(row) ? row : []).map((x) => normalizeText(x)));
  return need.every((k) => got.has(k));
}

function locateContineoLayout(rows) {
  const all = Array.isArray(rows) ? rows : [];
  let headerIndex = -1;
  for (let i = 0; i < Math.min(all.length, 12); i += 1) {
    if (isContineoMatrixHeaderRow(all[i])) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) return null;
  const titleIndex = headerIndex;
  const componentIndex = Math.min(headerIndex + 1, all.length - 1);
  const dataStartIndex = Math.min(headerIndex + 2, all.length);
  return { titleIndex, headerIndex, componentIndex, dataStartIndex };
}

function isContineoMatrix(rows) {
  return locateContineoLayout(rows) !== null;
}

function parseContineoRows(rows, { uploadId, bodyClassLabel }) {
  const layout = locateContineoLayout(rows);
  if (!layout) {
    return { studentsPayload: [], subjectsFound: 0, uploadMeta: null };
  }
  const headerRow = rows[layout.headerIndex] || [];
  const titleRow = rows[layout.titleIndex] || [];
  const componentRow = rows[layout.componentIndex] || [];
  const summaryStart = headerRow.findIndex(
    (v) => normalizeText(v) === "CRDTREGDINCRNTSEM"
  );
  const summaryStartFromComponent = componentRow.findIndex(
    (v) => normalizeText(v) === "CRDTREGDINCRNTSEM"
  );
  const summaryStartFromSemesterSummary = headerRow.findIndex(
    (v) => normalizeText(v) === "SEMESTERSUMMARY"
  );
  const summaryBoundaryCandidates = [
    summaryStart,
    summaryStartFromComponent,
    summaryStartFromSemesterSummary,
  ].filter((n) => Number.isInteger(n) && n >= 0);
  const resolvedSummaryStart =
    summaryBoundaryCandidates.length > 0
      ? Math.min(...summaryBoundaryCandidates)
      : -1;

  const subjectStarts = [];
  for (let col = 7; col < headerRow.length; col += 1) {
    if (resolvedSummaryStart !== -1 && col >= resolvedSummaryStart) break;
    const code = trimStr(headerRow[col]);
    if (!code) continue;
    subjectStarts.push(col);
  }

  const blocks = subjectStarts.map((start, i) => {
    const end =
      i + 1 < subjectStarts.length
        ? subjectStarts[i + 1] - 1
        : resolvedSummaryStart > 0
          ? resolvedSummaryStart - 1
          : headerRow.length - 1;
    const lookup = {};
    for (let c = start; c <= end; c += 1) {
      lookup[normalizeText(componentRow[c])] = c;
    }
    return {
      start,
      end,
      code: trimStr(headerRow[start]),
      name: trimStr(titleRow[start]),
      colIseTh: lookup.ISETH,
      colIsePr: lookup.ISEPRISETU,
      colMse: lookup.MSE,
      colEse: lookup.ESE,
      colTotal: lookup.TOTAL,
      colGrade: lookup.GR,
      colCredits: lookup.CRE,
    };
  });

  const studentsPayload = [];
  let subjectsFound = 0;
  let uploadMeta = null;

  // Common columns in this matrix format
  const COL_USN = 1;
  const COL_ROLL = 2;
  const COL_NAME = 3;
  const COL_SECTION = 4;
  const COL_SGPA = 112;
  const COL_CGPA = 118;
  const COL_REMARKS = 120;
  const COL_FAILED = 121;

  for (let r = layout.dataStartIndex; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const name = trimStr(row[COL_NAME]);
    const prn = formatIdentifier(row[COL_USN]);
    if (!name && !prn) continue;

    const section = trimStr(row[COL_SECTION]);
    const classLabel = bodyClassLabel || section || "";
    const sgpa = parseNumberLoose(row[COL_SGPA]);
    const cgpa = parseNumberLoose(row[COL_CGPA]);
    const remarks = trimStr(row[COL_REMARKS]);
    const failedCourses = trimStr(row[COL_FAILED]);
    const result =
      remarks ||
      (failedCourses ? "Fail" : "");
    const percentage =
      sgpa != null && Number.isFinite(Number(sgpa)) ? Number(sgpa) * 10 : undefined;

    const subjects = [];
    for (const b of blocks) {
      const grade = trimStr(row[b.colGrade]);
      const total = parseNumberLoose(row[b.colTotal]);
      const hasAny =
        grade ||
        total != null ||
        parseNumberLoose(row[b.colIseTh]) != null ||
        parseNumberLoose(row[b.colIsePr]) != null ||
        parseNumberLoose(row[b.colMse]) != null ||
        parseNumberLoose(row[b.colEse]) != null;
      if (!hasAny) continue;

      const gUpper = grade.toUpperCase();
      const subResult = gUpper === "F" ? "Fail" : grade ? "Pass" : "";
      subjects.push({
        code: b.code,
        name: b.name || b.code,
        internal: parseNumberLoose(row[b.colIseTh]),
        ise2: parseNumberLoose(row[b.colIsePr]),
        mse: parseNumberLoose(row[b.colMse]),
        external: parseNumberLoose(row[b.colEse]),
        total,
        grade,
        credits: parseNumberLoose(row[b.colCredits]),
        result: subResult,
      });
    }

    if (!subjects.length) continue;
    subjectsFound += subjects.length;
    const studentDoc = {
      name,
      prn,
      seatNo: trimStr(row[COL_ROLL]),
      semester: undefined,
      examMonth: "",
      examYear: undefined,
      branch: "",
      sgpa,
      cgpa,
      totalMarks: undefined,
      percentage,
      result,
      uploadId,
      classLabel,
      subjects,
    };
    studentsPayload.push(studentDoc);

    if (!uploadMeta) {
      uploadMeta = { classLabel, semester: undefined, examMonth: "", examYear: undefined, branch: "" };
    }
  }

  return { studentsPayload, subjectsFound, uploadMeta };
}

/**
 * POST /api/upload — multipart field `file` (faculty only).
 * Body (optional): `classLabel` — overrides per-row derivation when provided.
 */
export async function uploadSpreadsheet(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Bad Request",
        message: 'Missing file. Send multipart/form-data with field name "file".',
      });
    }

    if (!req.file.buffer || !Buffer.isBuffer(req.file.buffer)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Uploaded file could not be read.",
      });
    }

    if (req.file.size === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Uploaded file is empty.",
      });
    }

    const facultyId = req.user?.userId;

    if (!facultyId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authenticated user is missing userId.",
      });
    }

    const uploadId = `${facultyId}-${Date.now()}`;
    const bodyClassLabel = trimStr(req.body?.classLabel);

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, {
        type: "buffer",
        cellDates: true,
        cellNF: false,
        cellText: false,
      });
    } catch (err) {
      console.error("[upload] XLSX.read failed:", err);
      return res.status(400).json({
        error: "Bad Request",
        message: "The file is not a valid Excel workbook or could not be parsed.",
      });
    }

    const sheetNames = Array.isArray(workbook.SheetNames) ? workbook.SheetNames : [];
    if (sheetNames.length !== 1) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Invalid format. Upload must contain exactly one worksheet with the required column structure.",
      });
    }

    // Sheet/file name is not enforced; structure is enforced via required headers below.
    const [onlySheetName] = sheetNames;
    const sheet = workbook.Sheets[onlySheetName];
    let rows;
    try {
      rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      });
    } catch (err) {
      console.error("[upload] sheet_to_json failed:", err);
      return res.status(400).json({
        error: "Bad Request",
        message: 'Could not convert worksheet "DetailedResultSheet" to rows.',
      });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: 'Worksheet "DetailedResultSheet" has no data rows.',
      });
    }

    let studentsPayload = [];
    let subjectsFound = 0;
    let uploadMeta = null;

    const headerCheck = validateMandatoryDetailedResultHeaders(rows);
    if (headerCheck.ok) {
      for (const row of rows) {
        if (isRowEmpty(row)) continue;

        const semester = parseNumber(
          getCell(row, "SEM", "SEMESTER", "SEM NO", "SEMNO", "TERM")
        );
        const branch = trimStr(
          getCell(
            row,
            "BRANCH",
            "DEPT",
            "DEPARTMENT",
            "STREAM",
            "SPECIALIZATION_MAJOR",
            "COURSE_CODE"
          )
        );
        const classLabel =
          bodyClassLabel ||
          trimStr(
            getCell(
              row,
              "CLASS",
              "CLASS LABEL",
              "CLASSLABEL",
              "DIVISION",
              "DIV",
              "SECTION",
              "BATCH"
            )
          ) ||
          deriveClassLabel(branch, semester);

        const studentDoc = mapRowToStudent(row, { uploadId, classLabel });
        subjectsFound += studentDoc.subjects.length;
        studentsPayload.push(studentDoc);

        if (!uploadMeta) {
          uploadMeta = {
            classLabel,
            semester,
            examMonth: trimStr(getCell(row, "MONTH", "MON", "EXAM MONTH")),
            examYear: parseNumber(getCell(row, "YEAR", "EXAM YEAR")),
            branch,
          };
        }
      }
    } else {
      let matrixRows;
      try {
        matrixRows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });
      } catch {
        matrixRows = [];
      }
      if (!isContineoMatrix(matrixRows)) {
        return res.status(400).json({
          error: "Bad Request",
          message:
            "Invalid sheet structure. Expected either DetailedResultSheet columns or Contineo matrix format.",
        });
      }
      const parsed = parseContineoRows(matrixRows, { uploadId, bodyClassLabel });
      studentsPayload = parsed.studentsPayload;
      subjectsFound = parsed.subjectsFound;
      uploadMeta = parsed.uploadMeta;
    }

    if (studentsPayload.length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "No student rows found. Ensure name and PRN/USN/Roll columns are present (see template column names).",
      });
    }

    const rowCount = studentsPayload.length;

    const uploadDoc = {
      uploadId,
      facultyId,
      originalFileName: trimStr(req.file.originalname),
      fileMimeType: trimStr(req.file.mimetype),
      fileSizeBytes: req.file.size,
      fileBuffer: req.file.buffer,
      classLabel: uploadMeta?.classLabel ?? bodyClassLabel ?? "",
      semester: uploadMeta?.semester,
      examMonth: uploadMeta?.examMonth,
      examYear: uploadMeta?.examYear,
      branch: uploadMeta?.branch,
      rowCount,
      createdAt: new Date(),
    };

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error("[upload] MONGO_URI is not configured");
      return res.status(500).json({
        error: "Server configuration error",
        message: "Database is not configured.",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        error: "Service Unavailable",
        message: "Database connection is not ready. Try again shortly.",
      });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Upload.create([uploadDoc], { session });
        await Student.insertMany(studentsPayload, {
          session,
          ordered: true,
        });
      });
    } catch (err) {
      console.error("[upload] Transaction failed:", err);
      if (err?.code === 11000) {
        return res.status(409).json({
          error: "Conflict",
          message: "Upload id or related unique constraint conflict. Retry the upload.",
        });
      }
      if (err?.name === "ValidationError") {
        return res.status(400).json({
          error: "Validation Error",
          message: err.message || "Student or upload data failed validation.",
        });
      }
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to persist upload data.",
      });
    } finally {
      session.endSession();
    }

    return res.status(201).json({
      uploadId,
      rowCount,
      subjectsFound,
    });
  } catch (err) {
    next(err);
  }
}
