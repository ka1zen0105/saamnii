function squeezeSpaces(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function stripCodePrefix(text) {
  return text.replace(/^[A-Z0-9]{6,}\s+/i, "").trim();
}

function stripRatioSuffix(text) {
  return text.replace(/\s*\([^)]*[:/-][^)]*\)\s*$/g, "").trim();
}

export function subjectDisplayName(value) {
  const raw = squeezeSpaces(value);
  if (!raw) return "";

  const dashParts = raw
    .split(/\s+[—-]\s+/)
    .map((p) => squeezeSpaces(p))
    .filter(Boolean);
  const dedupedParts = Array.from(new Set(dashParts));
  const preferred = dedupedParts[dedupedParts.length - 1] || raw;

  const concise = stripRatioSuffix(stripCodePrefix(preferred));
  return concise || preferred || raw;
}

