import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFaculty,
  fetchAdminMeta,
  fetchSemesterSubjectCatalog,
  listFaculty,
  listSchoolClasses,
  patchFacultySemesterSubjects,
  patchFacultySubjects,
  downloadSemesterSubjectCatalogTemplate,
  uploadSemesterSubjectCatalog,
} from "../../api/adminApi.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import "../../styles/facultyPages.css";
import "../../styles/adminPages.css";

export function FacultyAccessPage() {
  const [faculty, setFaculty] = useState([]);
  const [classes, setClasses] = useState([]);
  const [meta, setMeta] = useState({ classes: [], subjectCodes: [] });
  const [semesterCatalog, setSemesterCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [newUserId, setNewUserId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  /** Faculty selected for subject + class allocation */
  const [allocationUserId, setAllocationUserId] = useState("");
  const [allocationSemester, setAllocationSemester] = useState(3);
  const [allocationSubjects, setAllocationSubjects] = useState([]);
  const [allocationSubjectQuery, setAllocationSubjectQuery] = useState("");
  const [catalogFile, setCatalogFile] = useState(null);
  const [catalogSemester, setCatalogSemester] = useState("1");
  const [catalogUploading, setCatalogUploading] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [f, c, m] = await Promise.all([
        listFaculty(),
        listSchoolClasses(),
        fetchAdminMeta(),
      ]);
      const semCatalog = await fetchSemesterSubjectCatalog();
      setFaculty(Array.isArray(f) ? f : []);
      setClasses(Array.isArray(c) ? c : []);
      setSemesterCatalog(Array.isArray(semCatalog) ? semCatalog : []);
      setMeta({
        classes: Array.isArray(m?.classes) ? m.classes : [],
        subjectCodes: Array.isArray(m?.subjectCodes) ? m.subjectCodes : [],
      });
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (faculty.length && !allocationUserId) {
      setAllocationUserId(faculty[0].userId);
    }
  }, [faculty, allocationUserId]);

  useEffect(() => {
    const u = faculty.find((x) => x.userId === allocationUserId);
    const semRows = Array.isArray(u?.semesterSubjectAssignments)
      ? u.semesterSubjectAssignments
      : [];
    const semMatch = semRows.find((r) => Number(r.semester) === Number(allocationSemester));
    if (u) {
      setAllocationSubjects([...(semMatch?.subjectCodes ?? [])]);
    } else {
      setAllocationSubjects([]);
    }
  }, [allocationUserId, allocationSemester, faculty]);

  const subjectOptions = useMemo(() => {
    const fromCatalog = semesterCatalog.find(
      (s) => Number(s?.semester) === Number(allocationSemester)
    );
    const mapped = (fromCatalog?.subjects ?? []).map((s) => ({
      code: String(s.code).trim(),
      name: String(s.name || "").trim(),
    }));
    const map = new Map();
    for (const s of mapped) {
      if (s.code) map.set(s.code, s.name);
    }
    for (const code of meta.subjectCodes ?? []) {
      const c = String(code).trim();
      if (c && !map.has(c)) map.set(c, "");
    }
    for (const code of allocationSubjects ?? []) {
      const c = String(code).trim();
      if (c && !map.has(c)) map.set(c, "");
    }
    // Accept ratio text inside brackets with flexible formats, e.g. (3:1), (2-0-2), (TH:PR)
    const hasBracketRatio = (value) => /\([^)]*[:\/-][^)]*\)/.test(String(value || ""));

    const namedSubjects = [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .filter((s) => Boolean(s.code) && Boolean(s.name));

    const ratioNamedSubjects = namedSubjects.filter((s) => hasBracketRatio(s.name));
    const finalSubjects = ratioNamedSubjects.length > 0 ? ratioNamedSubjects : namedSubjects;

    return finalSubjects.sort((a, b) => a.code.localeCompare(b.code));
  }, [semesterCatalog, allocationSemester, meta.subjectCodes, allocationSubjects]);

  const filteredSubjectOptions = useMemo(() => {
    const q = String(allocationSubjectQuery || "").trim().toLowerCase();
    if (!q) return subjectOptions;
    return subjectOptions.filter((s) => {
      const code = String(s.code || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [allocationSubjectQuery, subjectOptions]);

  function flash(message) {
    setMsg(message);
    setTimeout(() => setMsg(""), 3500);
  }

  function renderChips(items) {
    const values = Array.isArray(items)
      ? items.map((v) => String(v || "").trim()).filter(Boolean)
      : [];
    if (!values.length) return <span className="muted-chip">—</span>;
    return (
      <div className="inline-chip-list">
        {values.map((value) => (
          <span key={value} className="inline-chip">
            {value}
          </span>
        ))}
      </div>
    );
  }

  async function onAddTeacher(e) {
    e.preventDefault();
    setErr("");
    try {
      await createFaculty({
        userId: newUserId.trim(),
        displayLabel: newLabel.trim(),
        email: newEmail.trim(),
        password: newPassword,
      });
      setNewUserId("");
      setNewLabel("");
      setNewEmail("");
      setNewPassword("");
      flash("Teacher created.");
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Could not create teacher.");
    }
  }

  async function onSaveFacultyAllocation(e) {
    e.preventDefault();
    if (!allocationUserId) {
      setErr("Select a faculty member.");
      return;
    }
    setErr("");
    try {
      await Promise.all([
        patchFacultySemesterSubjects(
          allocationUserId,
          allocationSemester,
          allocationSubjects
        ),
        patchFacultySubjects(allocationUserId, allocationSubjects),
      ]);
      flash(`Subjects (Sem ${allocationSemester}) saved for this faculty.`);
      await load();
    } catch (e) {
      setErr(
        e?.response?.data?.message || e.message || "Could not update faculty assignments."
      );
    }
  }

  async function onUploadSubjectCatalog(e) {
    e.preventDefault();
    if (!catalogFile) {
      setErr("Select an Excel file first.");
      return;
    }
    setErr("");
    setCatalogUploading(true);
    try {
      await uploadSemesterSubjectCatalog(catalogFile, Number(catalogSemester));
      setCatalogFile(null);
      flash("Semester subject catalog uploaded.");
      await load();
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          e.message ||
          "Could not upload semester subject catalog."
      );
    } finally {
      setCatalogUploading(false);
    }
  }

  async function onDownloadTemplate() {
    try {
      const blob = await downloadSemesterSubjectCatalogTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Subjects_Template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Could not download template.");
    }
  }

  return (
    <div className="faculty-page admin-page">
      <h1>Faculty Access</h1>
      {msg ? (
        <div className="banner" style={{ background: "#ecfdf5", color: "#065f46" }}>
          {msg}
        </div>
      ) : null}
      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="sub">Loading…</p>
      ) : (
        <>
          <div className="faculty-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Teacher ID</th>
                  <th>Display label</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Subject codes</th>
                  <th>Assigned classes</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      <code>{u.userId}</code>
                    </td>
                    <td>{u.displayLabel || "—"}</td>
                    <td>{u.email || "—"}</td>
                    <td>{u.contact || "—"}</td>
                    <td>{renderChips(u.subjectCodes)}</td>
                    <td>{renderChips(u.assignedClasses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {faculty.length === 0 ? (
              <p className="sub" style={{ padding: "1rem" }}>
                No faculty rows yet.
              </p>
            ) : null}
          </div>

          <div className="faculty-form-grid">
            <form onSubmit={onAddTeacher} className="access-card access-card-add">
              <fieldset>
                <legend>Add Teacher</legend>
                <label>
                  Teacher ID (login userId)
                  <input
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    required
                    placeholder="e.g. faculty01"
                  />
                </label>
                <label>
                  Display Label
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Dr. Example"
                  />
                </label>
                <label>
                  Email (optional)
                  <input
                    type="email"
                    autoComplete="off"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@institution.edu"
                  />
                </label>
                <label>
                  Password (min 6 characters)
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Initial login password"
                  />
                </label>
                <button type="submit" className="btn-primary-sm" style={{ marginTop: "0.5rem" }}>
                  Add Teacher
                </button>
              </fieldset>
            </form>

            <form onSubmit={onUploadSubjectCatalog} className="access-card access-card-add">
              <fieldset>
                <legend>Upload Semester Subject Sheet</legend>
                <p className="faculty-allocation-hint">
                  Upload Excel with columns: <strong>Semester</strong>,{" "}
                  <strong>Subject Code</strong>, <strong>Subject Name</strong>.
                </p>
                <button
                  type="button"
                  className="btn-muted"
                  onClick={onDownloadTemplate}
                  style={{ marginBottom: "0.5rem" }}
                >
                  Download Subject Template
                </button>
                <label>
                  Semester
                  <SearchableSelect
                    value={catalogSemester}
                    onChange={setCatalogSemester}
                    options={Array.from({ length: 8 }, (_, i) => String(i + 1)).map((s) => ({
                      value: s,
                      label: `Semester ${s}`,
                    }))}
                    disabled={catalogUploading}
                    placeholder="Select Semester"
                    searchPlaceholder="Search Semester..."
                  />
                </label>
                <label>
                  Subject Catalog File (.xlsx/.xls)
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setCatalogFile(e.target.files?.[0] || null)}
                    disabled={catalogUploading}
                  />
                </label>
                <button
                  type="submit"
                  className="btn-primary-sm"
                  style={{ marginTop: "0.5rem" }}
                  disabled={catalogUploading || !catalogFile}
                >
                  {catalogUploading ? "Uploading…" : "Upload Subject Catalog"}
                </button>
              </fieldset>
            </form>

            <form
              onSubmit={onSaveFacultyAllocation}
              className="access-card access-card-allocation"
            >
              <fieldset>
                <legend>Allocate Faculty — Subjects &amp; Classes</legend>
                <label>
                  Faculty
                  <SearchableSelect
                    value={allocationUserId}
                    onChange={setAllocationUserId}
                    options={faculty.map((u) => ({
                      value: u.userId,
                      label: u.displayLabel || u.userId,
                    }))}
                    disabled={!faculty.length}
                    placeholder="No Faculty Yet"
                    searchPlaceholder="Search Faculty..."
                  />
                </label>
                <label>
                  Semester
                  <SearchableSelect
                    value={String(allocationSemester)}
                    onChange={(v) => setAllocationSemester(Number(v))}
                    options={(semesterCatalog.length
                      ? semesterCatalog.map((s) => Number(s.semester))
                      : [3, 5]
                    ).map((s) => ({
                      value: String(s),
                      label: `Semester ${s}`,
                    }))}
                    disabled={!faculty.length}
                    placeholder="Select Semester"
                    searchPlaceholder="Search Semester..."
                  />
                </label>
                <label>
                  Subject Codes
                  <input
                    className="searchable-select-input"
                    type="text"
                    value={allocationSubjectQuery}
                    onChange={(e) => setAllocationSubjectQuery(e.target.value)}
                    placeholder="Search Subject Code..."
                    disabled={!faculty.length}
                  />
                  <select
                    className="faculty-multi"
                    multiple
                    value={allocationSubjects}
                    onChange={(e) =>
                      setAllocationSubjects(
                        [...e.target.selectedOptions].map((o) => o.value)
                      )
                    }
                    disabled={!faculty.length}
                    size={Math.min(12, Math.max(4, filteredSubjectOptions.length || 4))}
                  >
                    {filteredSubjectOptions.length === 0 ? (
                      <option value="" disabled>
                        No subject codes yet — upload marks or add curriculum first
                      </option>
                    ) : (
                      filteredSubjectOptions.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code}
                          {s.name ? ` — ${s.name}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <button
                  type="submit"
                  className="btn-primary-sm"
                  style={{ marginTop: "0.5rem" }}
                  disabled={!faculty.length}
                >
                  Save Faculty Assignments
                </button>
              </fieldset>
            </form>

          </div>
        </>
      )}
    </div>
  );
}
