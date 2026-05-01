import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFaculty,
  deleteFaculty,
  fetchAdminMeta,
  fetchSemesterSubjectCatalog,
  fetchSubjectSemesters,
  fetchSubjectsBySemester,
  listFaculty,
  listSchoolClasses,
  patchFacultySemesterSubjects,
  downloadSemesterSubjectCatalogTemplate,
  uploadSemesterSubjectCatalog,
} from "../../api/adminApi.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import { toFacultySelectOption } from "../../utils/facultySelect.js";
import "../../styles/facultyPages.css";
import "../../styles/adminPages.css";

export function FacultyAccessPage() {
  const [faculty, setFaculty] = useState([]);
  const [classes, setClasses] = useState([]);
  const [meta, setMeta] = useState({ classes: [], subjectCodes: [] });
  const [subjectSemesters, setSubjectSemesters] = useState([]);
  const [semesterSubjects, setSemesterSubjects] = useState([]);
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
  const [deletingUserId, setDeletingUserId] = useState("");
  const semesterOptions = useMemo(() => {
    const fromApi = (Array.isArray(subjectSemesters) ? subjectSemesters : [])
      .map((s) => Number(s))
      .filter((s) => Number.isFinite(s));
    const fallback = Array.from({ length: 8 }, (_, i) => i + 1);
    const merged = [...new Set(fromApi.length ? fromApi : fallback)].sort((a, b) => a - b);
    return merged.map((s) => ({ value: String(s), label: `Semester ${s}` }));
  }, [subjectSemesters]);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [fRes, cRes, mRes, semRes, catRes] = await Promise.allSettled([
        listFaculty(),
        listSchoolClasses(),
        fetchAdminMeta(),
        fetchSubjectSemesters(),
        fetchSemesterSubjectCatalog(),
      ]);

      if (fRes.status === "fulfilled") {
        setFaculty(Array.isArray(fRes.value) ? fRes.value : []);
      }
      if (cRes.status === "fulfilled") {
        setClasses(Array.isArray(cRes.value) ? cRes.value : []);
      }
      if (mRes.status === "fulfilled") {
        const m = mRes.value;
        setMeta({
          classes: Array.isArray(m?.classes) ? m.classes : [],
          subjectCodes: Array.isArray(m?.subjectCodes) ? m.subjectCodes : [],
        });
      }
      if (semRes.status === "fulfilled") {
        const semesters = semRes.value;
        setSubjectSemesters(
          (Array.isArray(semesters) ? semesters : [])
            .map((s) => Number(s))
            .filter((s) => Number.isFinite(s))
            .sort((a, b) => a - b)
        );
      }
      if (catRes.status === "fulfilled") {
        setSemesterCatalog(Array.isArray(catRes.value) ? catRes.value : []);
      }

      if (
        fRes.status !== "fulfilled" &&
        cRes.status !== "fulfilled" &&
        mRes.status !== "fulfilled" &&
        semRes.status !== "fulfilled" &&
        catRes.status !== "fulfilled"
      ) {
        throw new Error("Failed to load admin data.");
      }
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

  useEffect(() => {
    if (!subjectSemesters.length) return;
    const current = Number(allocationSemester);
    const present = subjectSemesters.some((s) => Number(s) === current);
    if (!present) {
      setAllocationSemester(Number(subjectSemesters[0]));
    }
  }, [subjectSemesters, allocationSemester]);

  useEffect(() => {
    let cancelled = false;
    fetchSubjectsBySemester(allocationSemester)
      .then((rows) => {
        if (cancelled) return;
        const byApi = Array.isArray(rows) ? rows : [];
        if (byApi.length > 0) {
          setSemesterSubjects(byApi);
          return;
        }
        const fromCatalog = (Array.isArray(semesterCatalog) ? semesterCatalog : []).find(
          (s) => Number(s?.semester) === Number(allocationSemester)
        );
        const fallbackRows = (fromCatalog?.subjects ?? []).map((s) => ({
          subject_code: String(s?.code || "").trim(),
          subject_name: String(s?.name || "").trim(),
        }));
        setSemesterSubjects(fallbackRows);
      })
      .catch(() => {
        if (cancelled) return;
        const fromCatalog = (Array.isArray(semesterCatalog) ? semesterCatalog : []).find(
          (s) => Number(s?.semester) === Number(allocationSemester)
        );
        const fallbackRows = (fromCatalog?.subjects ?? []).map((s) => ({
          subject_code: String(s?.code || "").trim(),
          subject_name: String(s?.name || "").trim(),
        }));
        setSemesterSubjects(fallbackRows);
      });
    return () => {
      cancelled = true;
    };
  }, [allocationSemester, semesterCatalog]);

  const subjectOptions = useMemo(() => {
    const mapped = (Array.isArray(semesterSubjects) ? semesterSubjects : []).map((s) => ({
      code: String(s.subject_code || "").trim(),
      name: String(s.subject_name || "").trim(),
    }));
    const strictMap = new Map();
    for (const s of mapped) {
      if (s.code) strictMap.set(s.code, s.name);
    }
    const namedSubjects = [...strictMap.entries()]
      .map(([code, name]) => ({ code, name }))
      .filter((s) => Boolean(s.code));

    return namedSubjects.sort((a, b) => a.code.localeCompare(b.code));
  }, [semesterSubjects]);

  const filteredSubjectOptions = useMemo(() => {
    const q = String(allocationSubjectQuery || "").trim().toLowerCase();
    if (!q) return subjectOptions;
    return subjectOptions.filter((s) => {
      const code = String(s.code || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [allocationSubjectQuery, subjectOptions]);

  const selectedFaculty = useMemo(
    () => faculty.find((u) => u.userId === allocationUserId) || null,
    [faculty, allocationUserId]
  );

  const selectedFacultySemesterAssignments = useMemo(() => {
    const rows = Array.isArray(selectedFaculty?.semesterSubjectAssignments)
      ? selectedFaculty.semesterSubjectAssignments
      : [];
    return [...rows]
      .map((row) => ({
        semester: Number(row?.semester),
        subjectCodes: Array.isArray(row?.subjectCodes)
          ? row.subjectCodes.map((c) => String(c || "").trim()).filter(Boolean)
          : [],
      }))
      .filter((row) => Number.isFinite(row.semester))
      .sort((a, b) => a.semester - b.semester);
  }, [selectedFaculty]);

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
      const updated = await patchFacultySemesterSubjects(
        allocationUserId,
        allocationSemester,
        allocationSubjects
      );
      if (updated?.userId) {
        setFaculty((prev) =>
          prev.map((u) => (u.userId === updated.userId ? { ...u, ...updated } : u))
        );
      }
      flash(`Subjects (Sem ${allocationSemester}) saved for this faculty.`);
      await load();
    } catch (e) {
      setErr(
        e?.response?.data?.message || e.message || "Could not update faculty assignments."
      );
    }
  }

  function onRemoveAllocationSubject(subjectCode) {
    const code = String(subjectCode || "").trim();
    if (!code) return;
    setAllocationSubjects((prev) => prev.filter((c) => String(c).trim() !== code));
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
      setAllocationSemester(Number(catalogSemester));
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

  async function onDeleteTeacher(u) {
    const label = u.displayLabel || u.userId;
    const confirmed = window.confirm(
      `Delete teacher "${label}" (${u.userId})?\n\n` +
        "This removes the faculty account and permanently deletes all of their uploads and every student mark row tied to those uploads. Any class with this user as assigned teacher will have that field cleared.\n\n" +
        "This cannot be undone."
    );
    if (!confirmed) return;
    setErr("");
    setDeletingUserId(u.userId);
    try {
      await deleteFaculty(u.userId);
      flash("Teacher removed.");
      if (allocationUserId === u.userId) {
        setAllocationUserId("");
      }
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Could not delete teacher.");
    } finally {
      setDeletingUserId("");
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
                  <th>Actions</th>
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
                    <td>
                      <button
                        type="button"
                        className="btn-danger faculty-access-delete"
                        disabled={Boolean(deletingUserId)}
                        onClick={() => onDeleteTeacher(u)}
                      >
                        {deletingUserId === u.userId ? "Removing…" : "Delete"}
                      </button>
                    </td>
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
                      label: `Force Semester ${s}`,
                    }))}
                    disabled={catalogUploading}
                    placeholder="Force Semester 1-8"
                    searchPlaceholder="Type semester number…"
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
                    options={faculty.map(toFacultySelectOption)}
                    disabled={!faculty.length}
                    placeholder="No Faculty Yet"
                    searchPlaceholder="Search by name, email, or ID…"
                  />
                </label>
                <label>
                  Semester
                  <SearchableSelect
                    value={String(allocationSemester)}
                    onChange={(v) => setAllocationSemester(Number(v))}
                    options={semesterOptions}
                    disabled={!faculty.length}
                    placeholder="Select Semester"
                    searchPlaceholder="Type semester number…"
                  />
                </label>
                {selectedFaculty ? (
                  <div className="faculty-allocation-hint" style={{ marginTop: "0.25rem" }}>
                    <strong>Current semester-wise assignments:</strong>{" "}
                    {selectedFacultySemesterAssignments.length === 0
                      ? "None yet."
                      : selectedFacultySemesterAssignments
                          .map((row) =>
                            `Sem ${row.semester}: ${
                              row.subjectCodes.length ? row.subjectCodes.join(", ") : "—"
                            }`
                          )
                          .join(" | ")}
                  </div>
                ) : null}
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
                <div className="faculty-allocation-hint" style={{ marginTop: "0.5rem" }}>
                  <strong>Assigned for Semester {allocationSemester}:</strong>{" "}
                  {allocationSubjects.length === 0 ? "None" : null}
                  {allocationSubjects.length > 0 ? (
                    <div
                      className="inline-chip-list"
                      style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                    >
                      {allocationSubjects.map((code) => (
                        <span key={code} className="inline-chip">
                          {code}
                          <button
                            type="button"
                            className="btn-muted"
                            onClick={() => onRemoveAllocationSubject(code)}
                            title={`Remove ${code}`}
                            aria-label={`Remove ${code}`}
                            style={{ marginLeft: "0.5rem", padding: "0.05rem 0.35rem" }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
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
