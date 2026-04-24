/**
 * Short label for faculty pickers (prefer display name, not email).
 * @param {{ displayLabel?: string, userId?: string, email?: string }} f
 */
export function facultyOptionLabel(f) {
  const name = String(f?.displayLabel ?? "").trim();
  if (name) return name;
  const uid = String(f?.userId ?? "").trim();
  if (uid) return uid;
  return "Faculty";
}

/** Text used for search only (name, id, email, etc.). */
export function facultyOptionSearchText(f) {
  return [f?.displayLabel, f?.userId, f?.email, f?.contact]
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => String(v).trim())
    .join(" ");
}

/**
 * @param {{ displayLabel?: string, userId?: string, email?: string, contact?: string }} f
 */
export function toFacultySelectOption(f) {
  return {
    value: String(f?.userId ?? ""),
    label: facultyOptionLabel(f),
    searchText: facultyOptionSearchText(f),
  };
}
