import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchUploadRecords } from "../../api/analyticsApi.js";
import { listFaculty, listFacultyUploadsForAdmin } from "../../api/adminApi.js";
import "../../styles/facultyPages.css";
import "../../styles/adminPages.css";
import { downloadElementAsPng } from "../../utils/exportPng.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import { subjectDisplayName } from "../../utils/subjectLabel.js";
import { toFacultySelectOption } from "../../utils/facultySelect.js";

const GRADE_ORDER = ["O", "A", "B", "C", "D", "E", "P", "F"];

function classifyGradeFromPercentage(pct) {
  if (!Number.isFinite(pct)) return null;
  if (pct >= 85) return "O";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 45) return "E";
  if (pct >= 40) return "P";
  return "F";
}

function toFinite(value) {
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

function subjectKey(row) {
  const code = String(row?.subjectCode ?? "").trim();
  const name = String(row?.subject ?? "").trim();
  return code && name ? `${code} — ${name}` : code || name || "Unknown Subject";
}

function canonicalSubjectCode(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const firstLine = raw.split(/\r?\n/)[0].trim();
  const firstToken = firstLine.split(/\s+/)[0].trim();
  return firstToken.toUpperCase();
}

function buildExamGradeDistribution(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const observed = new Map();
  for (const r of list) {
    const key = subjectKey(r);
    if (!observed.has(key)) observed.set(key, { ISE: [], ISE2: [], MSE: [], ESE: [] });
    const bucket = observed.get(key);
    const ise = toFinite(r?.ise1);
    const ise2 = toFinite(r?.ise2);
    const mse = toFinite(r?.mse);
    const ese = toFinite(r?.ese);
    if (ise != null && ise >= 0) bucket.ISE.push(ise);
    if (ise2 != null && ise2 >= 0) bucket.ISE2.push(ise2);
    if (mse != null && mse >= 0) bucket.MSE.push(mse);
    if (ese != null && ese >= 0) bucket.ESE.push(ese);
  }

  const out = {};
  for (const [key, vals] of observed.entries()) {
    const maxISE = detectMaxMarks(vals.ISE.length ? Math.max(...vals.ISE) : null, 40);
    const maxISE2 = detectMaxMarks(vals.ISE2.length ? Math.max(...vals.ISE2) : null, 50);
    const maxMSE = detectMaxMarks(vals.MSE.length ? Math.max(...vals.MSE) : null, 30);
    const maxESE = detectMaxMarks(vals.ESE.length ? Math.max(...vals.ESE) : null, 30);
    const counts = Object.fromEntries(
      GRADE_ORDER.map((g) => [g, { grade: g, ISE: 0, ISE2: 0, MSE: 0, ESE: 0 }])
    );

    for (const r of list) {
      if (subjectKey(r) !== key) continue;
      const ise = toFinite(r?.ise1);
      const ise2 = toFinite(r?.ise2);
      const mse = toFinite(r?.mse);
      const ese = toFinite(r?.ese);

      const gIse = classifyGradeFromPercentage(ise != null ? (ise / maxISE) * 100 : NaN);
      const gIse2 = classifyGradeFromPercentage(ise2 != null ? (ise2 / maxISE2) * 100 : NaN);
      const gMse = classifyGradeFromPercentage(mse != null ? (mse / maxMSE) * 100 : NaN);
      const gEse = classifyGradeFromPercentage(ese != null ? (ese / maxESE) * 100 : NaN);

      if (gIse) counts[gIse].ISE += 1;
      if (gIse2) counts[gIse2].ISE2 += 1;
      if (gMse) counts[gMse].MSE += 1;
      if (gEse) counts[gEse].ESE += 1;
    }
    out[key] = GRADE_ORDER.map((g) => counts[g]);
  }
  return out;
}

export function AdminStudentAnalysisPage() {
  const barCaptureRef = useRef(null);
  const lineCaptureRef = useRef(null);
  const [faculty, setFaculty] = useState([]);
  const [facultyId, setFacultyId] = useState("");
  const [uploads, setUploads] = useState([]);
  const [uploadId, setUploadId] = useState("");
  const [rows, setRows] = useState([]);
  const [semester, setSemester] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [bulkPngBusy, setBulkPngBusy] = useState(false);

  const semesterOptions = useMemo(() => {
    const vals = Array.from(
      new Set(
        (rows || [])
          .map((r) => (r?.semester == null ? "" : String(r.semester).trim()))
          .filter(Boolean)
      )
    );
    return vals.sort((a, b) => Number(a) - Number(b));
  }, [rows]);

  const scopedRows = useMemo(() => {
    if (!semester) return rows;
    return (rows || []).filter((r) => String(r?.semester ?? "").trim() === semester);
  }, [rows, semester]);

  const bySubject = useMemo(() => buildExamGradeDistribution(scopedRows), [scopedRows]);
  const subjects = useMemo(() => Object.keys(bySubject), [bySubject]);
  const chartData = bySubject[subject] ?? [];
  const selectedFaculty = useMemo(
    () => faculty.find((f) => f.userId === facultyId) || null,
    [faculty, facultyId]
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const list = await listFaculty();
        setFaculty(Array.isArray(list) ? list : []);
        if (list?.length) setFacultyId(list[0].userId);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "Failed to load faculty list.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!facultyId) return;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const list = await listFacultyUploadsForAdmin(facultyId);
        setUploads(list);
        const pick = list[0]?.uploadId || "";
        setUploadId(pick);
        if (!pick) {
          setRows([]);
          return;
        }
        const rec = await fetchUploadRecords(pick);
        setRows(rec?.rows ?? []);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "Failed to load faculty uploads.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [facultyId]);

  useEffect(() => {
    if (!subject && subjects.length) setSubject(subjects[0]);
    if (subject && !subjects.includes(subject)) setSubject(subjects[0] || "");
  }, [subject, subjects]);

  useEffect(() => {
    if (!subjects.length) return;
    const assignedCodes = new Set(
      (selectedFaculty?.subjectCodes ?? [])
        .map((c) => canonicalSubjectCode(c))
        .filter(Boolean)
    );
    if (!assignedCodes.size) {
      setSubject(subjects[0]);
      return;
    }
    const match = subjects.find((s) => {
      const codePart = String(s).split("—")[0]?.trim() ?? "";
      return assignedCodes.has(canonicalSubjectCode(codePart));
    });
    setSubject(match || subjects[0]);
  }, [semester, facultyId, subjects, selectedFaculty]);

  useEffect(() => {
    if (!semester && semesterOptions.length) {
      // Keep default as all semesters.
      return;
    }
    if (semester && !semesterOptions.includes(semester)) {
      setSemester("");
    }
  }, [semester, semesterOptions]);

  async function onSelectUpload(nextUploadId) {
    if (!nextUploadId) return;
    setLoading(true);
    setErr("");
    try {
      const rec = await fetchUploadRecords(nextUploadId);
      setUploadId(nextUploadId);
      setRows(rec?.rows ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load selected upload.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function onDownloadBarPng() {
    await downloadElementAsPng(barCaptureRef.current, `${subject}-admin-grade-band-bar`);
  }

  async function onDownloadLinePng() {
    await downloadElementAsPng(lineCaptureRef.current, `${subject}-admin-grade-band-polygon`);
  }

  function subjectFileSlug(s) {
    const display = subjectDisplayName(s);
    return display
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "-")
      .slice(0, 96);
  }

  async function waitForCharts() {
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 420);
        });
      });
    });
  }

  async function onDownloadAllSubjectsPngs() {
    if (!semester) {
      setErr("Select a semester first, then download PNGs for all subjects in that semester.");
      return;
    }
    if (!subjects.length) {
      setErr("No subjects available for the current filters.");
      return;
    }
    if (scopedRows.length === 0) {
      setErr("No rows for the selected semester.");
      return;
    }

    setBulkPngBusy(true);
    setErr("");
    const previousSubject = subject;
    const list = [...subjects];
    const semLabel = String(semester).replace(/[^\w.-]+/g, "_");

    try {
      for (const subj of list) {
        flushSync(() => setSubject(subj));
        await waitForCharts();
        const base = `${semLabel}-${subjectFileSlug(subj)}`;
        await downloadElementAsPng(barCaptureRef.current, `${base}-admin-grade-band-bar`);
        await downloadElementAsPng(lineCaptureRef.current, `${base}-admin-grade-band-polygon`);
      }
    } catch (e) {
      setErr(e?.message || "Bulk PNG export failed.");
    } finally {
      if (previousSubject && subjects.includes(previousSubject)) {
        flushSync(() => setSubject(previousSubject));
      } else if (subjects[0]) {
        flushSync(() => setSubject(subjects[0]));
      }
      await waitForCharts();
      setBulkPngBusy(false);
    }
  }

  return (
    <div className="faculty-page admin-page">
      <h1>Grade Band</h1>
      <p className="sub">Faculty-wise student analytics from uploaded datasets.</p>

      <div className="faculty-toolbar">
        <label>
          Faculty
          <SearchableSelect
            value={facultyId}
            onChange={setFacultyId}
            options={faculty.map(toFacultySelectOption)}
            disabled={loading || bulkPngBusy}
            placeholder="No Faculty Available"
            searchPlaceholder="Search by name, email, or ID…"
          />
        </label>
        <label>
          Uploaded dataset
          <SearchableSelect
            value={uploadId}
            onChange={onSelectUpload}
            options={uploads.map((u) => ({
              value: u.uploadId,
              label: `${u.classLabel || "Class?"} • ${u.uploadId} • ${new Date(
                u.createdAt
              ).toLocaleString()}`,
            }))}
            disabled={loading || uploads.length === 0 || bulkPngBusy}
            placeholder="No Uploads Available"
            searchPlaceholder="Search class, upload ID, or date…"
          />
        </label>
        <label>
          Semester
          <SearchableSelect
            value={semester}
            onChange={setSemester}
            options={semesterOptions.map((s) => ({ value: s, label: s }))}
            disabled={loading || bulkPngBusy}
            placeholder="All Semesters"
            searchPlaceholder="Type semester number…"
          />
        </label>
        <label>
          Subject
          <SearchableSelect
            value={subject}
            onChange={setSubject}
            options={subjects.map((s) => ({ value: s, label: subjectDisplayName(s) }))}
            disabled={loading || subjects.length === 0 || bulkPngBusy}
            placeholder="No Subject Data"
            searchPlaceholder="Search code or subject name…"
          />
        </label>
        <div className="faculty-toolbar-spacer" aria-hidden="true" />
        <label className="faculty-toolbar-bulk-png">
          <span className="faculty-toolbar-bulk-png-label">Semester PNG pack</span>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={onDownloadAllSubjectsPngs}
            disabled={
              bulkPngBusy ||
              loading ||
              !semester ||
              subjects.length === 0 ||
              scopedRows.length === 0
            }
            title={
              !semester
                ? "Pick a semester first (not “All semesters”)."
                : "Downloads bar + line chart PNG for every subject in this semester."
            }
          >
            {bulkPngBusy ? "Exporting PNGs…" : "Download all subjects (PNG)"}
          </button>
        </label>
      </div>

      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="sub">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="sub">No uploaded records found for the selected faculty.</p>
      ) : scopedRows.length === 0 ? (
        <p className="sub">No rows found for selected semester.</p>
      ) : !subject ? (
        <p className="sub">No subject data found for selected upload.</p>
      ) : (
        <section className="grade-band-block">
            <div className="chart-card" style={{ border: "none", marginBottom: "1rem" }} ref={barCaptureRef}>
              <h2 style={{ fontSize: "1.05rem", textAlign: "center", fontWeight: 700 }}>
                {subjectDisplayName(subject)}
              </h2>
              <div style={{ marginBottom: "0.5rem" }}>
                <button type="button" className="btn-png" onClick={onDownloadBarPng}>
                  Download PNG
                </button>
              </div>
              <div className="chart-wrap" style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="grade" />
                    <YAxis allowDecimals={false} label={{ value: "No. of students", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ISE" fill="#3b6fb6" />
                    <Bar dataKey="ISE2" fill="#ed8936" name="ISE-TUT" />
                    <Bar dataKey="MSE" fill="#9e9e9e" />
                    <Bar dataKey="ESE" fill="#f3c200" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card" style={{ border: "none", marginBottom: 0 }} ref={lineCaptureRef}>
              <h2 style={{ fontSize: "1rem", textAlign: "center", fontWeight: 700 }}>
                Frequency polygon (same distribution)
              </h2>
              <div style={{ marginBottom: "0.5rem" }}>
                <button type="button" className="btn-png" onClick={onDownloadLinePng}>
                  Download PNG
                </button>
              </div>
              <div className="chart-wrap" style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="grade" />
                    <YAxis allowDecimals={false} label={{ value: "No. of students", angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="ISE" stroke="#3b6fb6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="ISE2" name="ISE-TUT" stroke="#ed8936" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="MSE" stroke="#9e9e9e" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="ESE" stroke="#f3c200" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
      )}
    </div>
  );
}
