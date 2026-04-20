import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFaculty,
  createSchoolClass,
  fetchAdminMeta,
  fetchSemesterSubjectCatalog,
  listFaculty,
  listSchoolClasses,
  patchClassCurriculum,
  patchClassTeacher,
  patchFacultyClasses,
  patchFacultySemesterSubjects,
  patchFacultySubjects,
} from "../../api/adminApi.js";
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
  const [allocationClasses, setAllocationClasses] = useState([]);

  const [newClassLabel, setNewClassLabel] = useState("");
  const [createClassTeacherId, setCreateClassTeacherId] = useState("");

  const [currClass, setCurrClass] = useState("");
  const [currLines, setCurrLines] = useState("");
  const [assignClassTeacherId, setAssignClassTeacherId] = useState("");

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
      setAllocationClasses([...(u.assignedClasses ?? [])]);
    } else {
      setAllocationSubjects([]);
      setAllocationClasses([]);
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
    return [...map.entries()]
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [semesterCatalog, allocationSemester, meta.subjectCodes, allocationSubjects]);

  const classOptions = useMemo(() => {
    const u = faculty.find((x) => x.userId === allocationUserId);
    const s = new Set([
      ...classes.map((c) => c.classLabel).filter(Boolean),
      ...(meta.classes ?? []),
      ...(u?.assignedClasses ?? []),
      ...allocationClasses,
    ]);
    return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [classes, meta.classes, faculty, allocationUserId, allocationClasses]);

  useEffect(() => {
    if (classes.length && !currClass) {
      const first = classes[0];
      setCurrClass(first.classLabel);
      setCurrLines((first.curriculum ?? []).join("\n"));
      setAssignClassTeacherId(first.teacherUserId ?? "");
    }
  }, [classes, currClass]);

  function flash(message) {
    setMsg(message);
    setTimeout(() => setMsg(""), 3500);
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
        patchFacultyClasses(allocationUserId, allocationClasses),
      ]);
      flash(`Subjects (Sem ${allocationSemester}) and classes saved for this faculty.`);
      await load();
    } catch (e) {
      setErr(
        e?.response?.data?.message || e.message || "Could not update faculty assignments."
      );
    }
  }

  async function onCreateClass(e) {
    e.preventDefault();
    setErr("");
    try {
      await createSchoolClass({
        classLabel: newClassLabel.trim(),
        teacherUserId: createClassTeacherId.trim() || undefined,
      });
      setNewClassLabel("");
      setCreateClassTeacherId("");
      flash("Class created.");
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Could not create class.");
    }
  }

  async function onSetClassTeacher(e) {
    e.preventDefault();
    if (!currClass) return;
    setErr("");
    try {
      await patchClassTeacher(currClass, assignClassTeacherId.trim());
      flash("Class teacher updated.");
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Could not assign teacher.");
    }
  }

  async function onSaveCurriculum(e) {
    e.preventDefault();
    if (!currClass) return;
    setErr("");
    try {
      await patchClassCurriculum(currClass, currLines);
      flash("Curriculum saved.");
      await load();
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Could not save curriculum.");
    }
  }

  function onPickClass(label) {
    setCurrClass(label);
    const doc = classes.find((c) => c.classLabel === label);
    setCurrLines((doc?.curriculum ?? []).join("\n"));
    setAssignClassTeacherId(doc?.teacherUserId ?? "");
  }

  return (
    <div className="faculty-page admin-page">
      <h1>Faculty access</h1>
      <p className="sub">
        Manage faculty identifiers, subject assignments, and class metadata stored in MongoDB.
      </p>

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
                    <td>{(u.subjectCodes ?? []).join(", ") || "—"}</td>
                    <td>{(u.assignedClasses ?? []).join(", ") || "—"}</td>
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
            <form onSubmit={onAddTeacher}>
              <fieldset>
                <legend>Add teacher</legend>
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
                  Display label
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
                  Add teacher
                </button>
              </fieldset>
            </form>

            <form onSubmit={onSaveFacultyAllocation}>
              <fieldset>
                <legend>Allocate faculty — subjects &amp; classes</legend>
                <p className="faculty-allocation-hint">
                  Choose a faculty member, then select one or more subject codes and class /
                  semester batches they teach. Use Ctrl+click (Windows) or Cmd+click (Mac) to
                  pick multiple rows in each list.
                </p>
                <label>
                  Faculty
                  <select
                    value={allocationUserId}
                    onChange={(e) => setAllocationUserId(e.target.value)}
                    disabled={!faculty.length}
                  >
                    {faculty.length === 0 ? (
                      <option value="">No faculty yet</option>
                    ) : (
                      faculty.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.userId}
                          {u.displayLabel ? ` — ${u.displayLabel}` : ""}
                          {u.contact ? ` (${u.contact})` : u.email ? ` (${u.email})` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label>
                  Semester
                  <select
                    value={allocationSemester}
                    onChange={(e) => setAllocationSemester(Number(e.target.value))}
                    disabled={!faculty.length}
                  >
                    {semesterCatalog.length ? (
                      semesterCatalog.map((s) => (
                        <option key={s.semester} value={s.semester}>
                          Semester {s.semester}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value={3}>Semester 3</option>
                        <option value={5}>Semester 5</option>
                      </>
                    )}
                  </select>
                </label>
                <label>
                  Subject codes
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
                    size={Math.min(12, Math.max(4, subjectOptions.length || 4))}
                  >
                    {subjectOptions.length === 0 ? (
                      <option value="" disabled>
                        No subject codes yet — upload marks or add curriculum first
                      </option>
                    ) : (
                      subjectOptions.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code}
                          {s.name ? ` — ${s.name}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label>
                  Classes / batches (semesters)
                  <select
                    className="faculty-multi"
                    multiple
                    value={allocationClasses}
                    onChange={(e) =>
                      setAllocationClasses(
                        [...e.target.selectedOptions].map((o) => o.value)
                      )
                    }
                    disabled={!faculty.length}
                    size={Math.min(12, Math.max(4, classOptions.length || 4))}
                  >
                    {classOptions.length === 0 ? (
                      <option value="" disabled>
                        No classes yet — create a class below or upload marks with class labels
                      </option>
                    ) : (
                      classOptions.map((label) => (
                        <option key={label} value={label}>
                          {label}
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
                  Save faculty assignments
                </button>
              </fieldset>
            </form>

            <form onSubmit={onCreateClass}>
              <fieldset>
                <legend>Class management</legend>
                <label>
                  New class label
                  <input
                    value={newClassLabel}
                    onChange={(e) => setNewClassLabel(e.target.value)}
                    required
                    placeholder="e.g. SE-A"
                  />
                </label>
                <label>
                  Class teacher (optional)
                  <select
                    value={createClassTeacherId}
                    onChange={(e) => setCreateClassTeacherId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {faculty.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.userId}
                        {u.displayLabel ? ` — ${u.displayLabel}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn-primary-sm" style={{ marginTop: "0.5rem" }}>
                  Create class
                </button>
              </fieldset>
            </form>

            <form onSubmit={onSetClassTeacher}>
              <fieldset>
                <legend>Assign class teacher</legend>
                <label>
                  Class
                  <select
                    value={currClass}
                    onChange={(e) => onPickClass(e.target.value)}
                    disabled={!classes.length}
                  >
                    {classes.length === 0 ? (
                      <option value="">No classes yet</option>
                    ) : (
                      classes.map((c) => (
                        <option key={c.classLabel} value={c.classLabel}>
                          {c.classLabel}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label>
                  Class teacher
                  <select
                    value={assignClassTeacherId}
                    onChange={(e) => setAssignClassTeacherId(e.target.value)}
                    disabled={!classes.length}
                  >
                    <option value="">— None —</option>
                    {faculty.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.userId}
                        {u.displayLabel ? ` — ${u.displayLabel}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="btn-primary-sm"
                  style={{ marginTop: "0.5rem" }}
                  disabled={!classes.length}
                >
                  Update teacher
                </button>
              </fieldset>
            </form>

            <form onSubmit={onSaveCurriculum}>
              <fieldset>
                <legend>Class curriculum</legend>
                <label>
                  Class
                  <select
                    value={currClass}
                    onChange={(e) => onPickClass(e.target.value)}
                    disabled={!classes.length}
                  >
                    {classes.length === 0 ? (
                      <option value="">No classes yet</option>
                    ) : (
                      classes.map((c) => (
                        <option key={c.classLabel} value={c.classLabel}>
                          {c.classLabel}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label>
                  Subject list (one code or line per line)
                  <textarea
                    value={currLines}
                    onChange={(e) => setCurrLines(e.target.value)}
                    placeholder={"CS101\nMA201\nHS301"}
                    disabled={!classes.length}
                  />
                </label>
                <button
                  type="submit"
                  className="btn-primary-sm"
                  style={{ marginTop: "0.5rem" }}
                  disabled={!classes.length}
                >
                  Save curriculum
                </button>
              </fieldset>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
