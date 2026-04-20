/**
 * Normalize Excel header labels so "SUB 1 NM", "Sub1Nm", "SUB1NM" match.
 * @param {string} key
 */
export function normalizeHeaderKey(key) {
  return String(key ?? "")
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[()\[\]:]/g, "")
    .replace(/[\s._-]+/g, "");
}

/**
 * Merge original row with normalized keys (last wins only for empty slots).
 * @param {Record<string, unknown>} row
 */
export function mergeNormalizedRow(row) {
  if (!row || typeof row !== "object") return {};
  /** @type {Record<string, unknown>} */
  const out = { ...row };
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeaderKey(k);
    if (out[nk] === undefined || out[nk] === "" || out[nk] === null) {
      out[nk] = v;
    }
  }
  return out;
}

/**
 * First non-empty cell among header aliases (after normalization).
 * @param {Record<string, unknown>} row
 * @param {string[]} aliases
 */
export function getCell(row, ...aliases) {
  const merged = mergeNormalizedRow(row);
  for (const a of aliases) {
    const k = normalizeHeaderKey(a);
    const v = merged[k];
    if (v !== undefined && v !== null && v !== "") {
      return v;
    }
  }
  return "";
}

/**
 * PRN / roll / USN as stable string (avoids scientific notation for large integers).
 * @param {unknown} v
 */
export function formatIdentifier(v) {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    if (Number.isInteger(v)) {
      try {
        return BigInt(v).toString();
      } catch {
        return String(v);
      }
    }
    return String(v);
  }
  let s = String(v).trim();
  if (/^[\d.]+[eE][+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n) && Number.isInteger(n)) {
      try {
        return BigInt(Math.round(n)).toString();
      } catch {
        return String(Math.round(n));
      }
    }
  }
  s = s.replace(/\s+/g, "");
  return s;
}

/**
 * Subject column helpers for SUB{i}* patterns with common VTU variants.
 * @param {Record<string, unknown>} row
 * @param {number} i 1..15
 * @param {"NM"|"CD"|"IA"|"IA2"|"MSE"|"ESE"|"TOT"|"GR"|"CR"|"R"} part
 */
export function getSubjectCell(row, i, part) {
  const merged = mergeNormalizedRow(row);
  const n = String(i);
  const candidates = [];
  if (part === "NM") {
    candidates.push(`SUB${n}NM`, `SUB${n}NAME`, `SUB${n}SUBJECT`, `SUBJ${n}`);
  } else if (part === "CD") {
    candidates.push(`SUB${n}CD`, `SUB${n}CODE`, `SUB${n}SUBCODE`, `SUB${n}`);
  } else if (part === "IA") {
    candidates.push(
      `SUB${n}IA`,
      `SUB${n}INT`,
      `SUB${n}INTRNL`,
      `SUB${n}INTERNAL`,
      `SUB${n}ISE`,
      `SUB${n}ISE1`,
      `SUB${n}CEMRKS`,
      `SUB${n}CAMRKS`
    );
  } else if (part === "IA2") {
    candidates.push(
      `SUB${n}IA2`,
      `SUB${n}ISE2`,
      `SUB${n}INT2`,
      `SUB${n}I2`,
      `SUB${n}IIA`
    );
  } else if (part === "MSE") {
    candidates.push(
      `SUB${n}MSE`,
      `SUB${n}MS`,
      `SUB${n}MID`,
      `SUB${n}MIDSEM`,
      `SUB${n}PRMRKS`
    );
  } else if (part === "ESE") {
    candidates.push(
      `SUB${n}ESE`,
      `SUB${n}EXT`,
      `SUB${n}EXTNL`,
      `SUB${n}EXTERNAL`,
      `SUB${n}TH`,
      `SUB${n}THEORY`,
      `SUB${n}THMRKS`
    );
  } else if (part === "TOT") {
    candidates.push(`SUB${n}TOT`, `SUB${n}TOTAL`, `SUB${n}TOTMARKS`, `SUB${n}MARKS`);
  } else if (part === "GR") {
    candidates.push(`SUB${n}GR`, `SUB${n}GRADE`, `SUB${n}GRD`);
  } else if (part === "CR") {
    candidates.push(`SUB${n}CR`, `SUB${n}CREDITS`, `SUB${n}CREDIT`);
  } else if (part === "R") {
    candidates.push(`SUB${n}R`, `SUB${n}RESULT`, `SUB${n}RES`, `SUB${n}PASS`);
  }
  for (const c of candidates) {
    const k = normalizeHeaderKey(c);
    const v = merged[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
}
