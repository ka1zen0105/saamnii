const COMPONENTS = [
  { key: "ISE", field: "ise1", fallbackMax: 40 },
  { key: "PR/TU", field: "ise2", fallbackMax: 50 },
  { key: "MSE", field: "mse", fallbackMax: 30 },
  { key: "ESE", field: "ese", fallbackMax: 30 },
];

function toFiniteNumber(value) {
  if (value === undefined || value === null || value === "" || value === "-") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function detectMaxMarks(observedMax, fallbackMax) {
  if (!Number.isFinite(observedMax) || observedMax <= 0) return fallbackMax;
  if (observedMax <= 20) return 20;
  if (observedMax <= 30) return 30;
  if (observedMax <= 40) return 40;
  if (observedMax <= 50) return 50;
  return 100;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function sampleStd(values, m) {
  if (values.length <= 1) return 0;
  const variance =
    values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(variance, 0));
}

function subjectLabel(row) {
  const code = String(row?.subjectCode ?? "").trim();
  const name = String(row?.subject ?? "").trim();
  if (code && name) return `${code} — ${name}`;
  return code || name || "Unknown Subject";
}

/**
 * Build ParsedSheetData-like structure from upload-record rows.
 * @param {Array<Record<string, unknown>>} rows
 */
export function parseRowsToSubjectData(rows) {
  /** @type {Record<string, Record<string, { max_marks: number, percentages: number[], mean: number, std: number, median: number, n: number, pass_rate: number }>>} */
  const out = {};
  const list = Array.isArray(rows) ? rows : [];

  /** @type {Map<string, Record<string, number[]>>} */
  const rawScores = new Map();
  for (const row of list) {
    const subj = subjectLabel(row);
    if (!rawScores.has(subj)) {
      rawScores.set(subj, { ISE: [], "PR/TU": [], MSE: [], ESE: [] });
    }
    const byComp = rawScores.get(subj);
    for (const comp of COMPONENTS) {
      const n = toFiniteNumber(row?.[comp.field]);
      if (n == null || n <= 0) continue;
      byComp[comp.key].push(n);
    }
  }

  for (const [subj, byComp] of rawScores.entries()) {
    const subjData = {};
    for (const comp of COMPONENTS) {
      const values = byComp[comp.key] ?? [];
      if (!values.length) continue;
      const observedMax = Math.max(...values);
      const max_marks = detectMaxMarks(observedMax, comp.fallbackMax);
      const percentages = values
        .map((v) => (v / max_marks) * 100)
        .filter((v) => Number.isFinite(v) && v > 0);
      if (!percentages.length) continue;
      const m = mean(percentages);
      const med = median(percentages);
      const std = sampleStd(percentages, m);
      const passCount = percentages.filter((v) => v >= 40).length;
      subjData[comp.key] = {
        max_marks,
        percentages,
        mean: m,
        std,
        median: med,
        n: percentages.length,
        pass_rate: (passCount / percentages.length) * 100,
      };
    }
    if (Object.keys(subjData).length > 0) {
      out[subj] = subjData;
    }
  }

  return out;
}

