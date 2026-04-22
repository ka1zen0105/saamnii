/**
 * Grade band thresholds (percentage). Upper bounds are exclusive except where noted.
 * O: >=85, A: [80,85), B: [70,80), C: [60,70), D: [50,60), E: [45,50), P: [40,45), F: <40
 */
const BAND_DEFINITIONS = [
  { gradeSymbol: "O", label: "85% and above" },
  { gradeSymbol: "A", label: "80% to below 85%" },
  { gradeSymbol: "B", label: "70% to below 80%" },
  { gradeSymbol: "C", label: "60% to below 70%" },
  { gradeSymbol: "D", label: "50% to below 60%" },
  { gradeSymbol: "E", label: "45% to below 50%" },
  { gradeSymbol: "P", label: "40% to below 45%" },
  { gradeSymbol: "F", label: "Below 40%" },
];

/** Default max marks for ISE component when using `internal` / `ise` marks. */
export const DEFAULT_ISE_MAX = 20;

/** Default max marks for ESE (`external`) when scaling percentage. */
export const DEFAULT_ESE_MAX = 30;

/** Default max marks for MSE when `subject.mse` is present. */
export const DEFAULT_MSE_MAX = 10;

/** Default max marks for second internal/practical component (`ise2`/`iseTu`). */
export const DEFAULT_ISE2_MAX = 20;

/**
 * Maps a percentage to a band index in `BAND_DEFINITIONS`, or null if unknown.
 * @param {number | null | undefined} pct
 * @returns {number | null}
 */
export function bandIndexForPercentage(pct) {
  if (pct == null || Number.isNaN(pct)) return null;
  if (pct >= 85) return 0;
  if (pct >= 80) return 1;
  if (pct >= 70) return 2;
  if (pct >= 60) return 3;
  if (pct >= 50) return 4;
  if (pct >= 45) return 5;
  if (pct >= 40) return 6;
  return 7;
}

/**
 * ISE% = (iseMarks / iseMax) * 100. Uses `subject.ise` when set, else `subject.internal`.
 * @param {Record<string, unknown>} subject
 * @returns {number | null}
 */
export function subjectIsePercent(subject) {
  const raw = subject?.ise != null ? subject.ise : subject?.internal;
  if (raw === undefined || raw === null || raw === "") return null;
  const marks = Number(raw);
  if (!Number.isFinite(marks)) return null;
  const max =
    subject?.iseMax != null && Number.isFinite(Number(subject.iseMax))
      ? Number(subject.iseMax)
      : DEFAULT_ISE_MAX;
  if (max <= 0) return null;
  return (marks / max) * 100;
}

/**
 * MSE% when `subject.mse` is present: (mse / mseMax) * 100.
 * @param {Record<string, unknown>} subject
 * @returns {number | null}
 */
export function subjectMsePercent(subject) {
  if (subject?.mse === undefined || subject?.mse === null || subject?.mse === "") {
    return null;
  }
  const marks = Number(subject.mse);
  if (!Number.isFinite(marks)) return null;
  const max =
    subject?.mseMax != null && Number.isFinite(Number(subject.mseMax))
      ? Number(subject.mseMax)
      : DEFAULT_MSE_MAX;
  if (max <= 0) return null;
  return (marks / max) * 100;
}

/**
 * ISE-TU% / ISE2% when `subject.ise2` is present: (ise2 / ise2Max) * 100.
 * @param {Record<string, unknown>} subject
 * @returns {number | null}
 */
export function subjectIse2Percent(subject) {
  if (subject?.ise2 === undefined || subject?.ise2 === null || subject?.ise2 === "") {
    return null;
  }
  const marks = Number(subject.ise2);
  if (!Number.isFinite(marks)) return null;
  const max =
    subject?.ise2Max != null && Number.isFinite(Number(subject.ise2Max))
      ? Number(subject.ise2Max)
      : DEFAULT_ISE2_MAX;
  if (max <= 0) return null;
  return (marks / max) * 100;
}

/**
 * ESE% = (external / eseMax) * 100; `eseMax` defaults to 30, overridable via `subject.eseMax`.
 * @param {Record<string, unknown>} subject
 * @returns {number | null}
 */
export function subjectEsePercent(subject) {
  if (subject?.external === undefined || subject?.external === null || subject?.external === "") {
    return null;
  }
  const marks = Number(subject.external);
  if (!Number.isFinite(marks)) return null;
  const max =
    subject?.eseMax != null && Number.isFinite(Number(subject.eseMax))
      ? Number(subject.eseMax)
      : DEFAULT_ESE_MAX;
  if (max <= 0) return null;
  return (marks / max) * 100;
}

/**
 * Total%: prefers `subject.percentage` when set; else `subject.total / maxTotal * 100`.
 * `maxTotal` is `subject.maxMarks`, or `credits * 25`, or ISE+MSE+ESE defaults when MSE absent/present.
 * @param {Record<string, unknown>} subject
 * @returns {number | null}
 */
export function subjectTotalPercent(subject) {
  if (subject?.percentage != null && subject?.percentage !== "") {
    const p = Number(subject.percentage);
    if (Number.isFinite(p)) return p;
  }

  if (subject?.total === undefined || subject?.total === null || subject?.total === "") {
    return null;
  }
  const total = Number(subject.total);
  if (!Number.isFinite(total)) return null;

  let denom = null;
  if (subject?.maxMarks != null && Number.isFinite(Number(subject.maxMarks))) {
    denom = Number(subject.maxMarks);
  } else if (
    subject?.credits != null &&
    subject?.credits !== "" &&
    Number.isFinite(Number(subject.credits)) &&
    Number(subject.credits) > 0
  ) {
    denom = Number(subject.credits) * 25;
  } else {
    const hasMse =
      subject?.mse !== undefined && subject?.mse !== null && subject?.mse !== "";
    const iseMax =
      subject?.iseMax != null && Number.isFinite(Number(subject.iseMax))
        ? Number(subject.iseMax)
        : DEFAULT_ISE_MAX;
    const mseMax = hasMse
      ? subject?.mseMax != null && Number.isFinite(Number(subject.mseMax))
        ? Number(subject.mseMax)
        : DEFAULT_MSE_MAX
      : 0;
    const eseMax =
      subject?.eseMax != null && Number.isFinite(Number(subject.eseMax))
        ? Number(subject.eseMax)
        : DEFAULT_ESE_MAX;
    denom = iseMax + mseMax + eseMax;
  }

  if (denom == null || !Number.isFinite(denom) || denom <= 0) return null;
  return (total / denom) * 100;
}

function emptyBandRows() {
  return BAND_DEFINITIONS.map((def) => ({
    label: def.label,
    gradeSymbol: def.gradeSymbol,
    ise: 0,
    iseTu: 0,
    mse: 0,
    ese: 0,
    total: 0,
  }));
}

function normalizeSubjectCode(code) {
  if (code === undefined || code === null) return "";
  return String(code).trim();
}

/**
 * Aggregates grade-band counts per subject (by subject code) for ISE, MSE (when present),
 * ESE, and total percentage.
 *
 * Pure: does not mutate `students`. Accepts plain objects or Mongoose documents (`.subjects`, `.toObject()`).
 *
 * @param {Array<Record<string, unknown>>} students
 * @returns {Array<{
 *   subjectCode: string,
 *   subjectName: string,
 *   bands: Array<{ label: string, gradeSymbol: string, ise: number, iseTu: number, mse: number, ese: number, total: number }>
 * }>}
 */
export function computeGradeBands(students) {
  if (!Array.isArray(students)) {
    return [];
  }

  /** @type {Map<string, { subjectName: string, bands: ReturnType<typeof emptyBandRows> }>} */
  const byCode = new Map();

  for (const student of students) {
    const subjects = student?.subjects;
    if (!Array.isArray(subjects)) continue;

    for (const subject of subjects) {
      const subjectCode = normalizeSubjectCode(subject?.code);
      const subjectName =
        subject?.name != null && String(subject.name).trim() !== ""
          ? String(subject.name).trim()
          : subjectCode || "Unknown subject";

      let entry = byCode.get(subjectCode);
      if (!entry) {
        entry = { subjectName, bands: emptyBandRows() };
        byCode.set(subjectCode, entry);
      } else if (entry.subjectName === "Unknown subject" && subjectName !== "Unknown subject") {
        entry.subjectName = subjectName;
      }

      const i = bandIndexForPercentage(subjectIsePercent(subject));
      const i2 = bandIndexForPercentage(subjectIse2Percent(subject));
      const m = bandIndexForPercentage(subjectMsePercent(subject));
      const e = bandIndexForPercentage(subjectEsePercent(subject));
      const t = bandIndexForPercentage(subjectTotalPercent(subject));

      if (i !== null) entry.bands[i].ise += 1;
      if (i2 !== null) entry.bands[i2].iseTu += 1;
      if (m !== null) entry.bands[m].mse += 1;
      if (e !== null) entry.bands[e].ese += 1;
      if (t !== null) entry.bands[t].total += 1;
    }
  }

  const codes = Array.from(byCode.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  return codes.map((subjectCode) => {
    const { subjectName, bands } = byCode.get(subjectCode);
    return {
      subjectCode,
      subjectName,
      bands: bands.map((row) => ({ ...row })),
    };
  });
}
