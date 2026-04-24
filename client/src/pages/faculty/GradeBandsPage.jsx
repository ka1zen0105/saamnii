import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchMyUploads, fetchUploadRecords } from "../../api/analyticsApi.js";
import "../../styles/facultyPages.css";
import { downloadElementAsPng } from "../../utils/exportPng.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import { subjectDisplayName } from "../../utils/subjectLabel.js";

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

function buildExamGradeDistribution(rows) {
  const list = Array.isArray(rows) ? rows : [];
  /** @type {Map<string, { ISE: number[], ISE2: number[], MSE: number[], ESE: number[] }>} */
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

  /** @type {Record<string, Array<{grade: string, ISE: number, ISE2: number, MSE: number, ESE: number}>>} */
  const out = {};
  for (const [key, vals] of observed.entries()) {
    const maxISE = detectMaxMarks(vals.ISE.length ? Math.max(...vals.ISE) : null, 40);
    const maxISE2 = detectMaxMarks(vals.ISE2.length ? Math.max(...vals.ISE2) : null, 50);
    const maxMSE = detectMaxMarks(vals.MSE.length ? Math.max(...vals.MSE) : null, 30);
    const maxESE = detectMaxMarks(vals.ESE.length ? Math.max(...vals.ESE) : null, 30);
    /** @type {Record<string, {grade: string, ISE: number, ISE2: number, MSE: number, ESE: number}>} */
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

export function GradeBandsPage() {
  const barCaptureRef = useRef(null);
  const lineCaptureRef = useRef(null);
  const [uploads, setUploads] = useState([]);
  const [currentUploadId, setCurrentUploadId] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const bySubject = useMemo(() => buildExamGradeDistribution(rows), [rows]);
  const subjects = useMemo(() => Object.keys(bySubject), [bySubject]);
  const [subject, setSubject] = useState("");

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const list = await fetchMyUploads();
      setUploads(list);
      const pick = list[0]?.uploadId || "";
      if (!pick) {
        setCurrentUploadId("");
        setRows([]);
        return;
      }
      setCurrentUploadId(pick);
      const rec = await fetchUploadRecords(pick);
      setRows(rec?.rows ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load grade bands.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!subject && subjects.length) setSubject(subjects[0]);
    if (subject && !subjects.includes(subject)) setSubject(subjects[0] || "");
  }, [subject, subjects]);

  async function onSelectUpload(uploadId) {
    if (!uploadId) return;
    setLoading(true);
    setErr("");
    try {
      const rec = await fetchUploadRecords(uploadId);
      setCurrentUploadId(uploadId);
      setRows(rec?.rows ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load selected upload.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const chartData = bySubject[subject] ?? [];

  async function onDownloadBarPng() {
    await downloadElementAsPng(barCaptureRef.current, `${subject}-grade-bands-bar`);
  }

  async function onDownloadLinePng() {
    await downloadElementAsPng(lineCaptureRef.current, `${subject}-grade-bands-polygon`);
  }

  return (
    <div className="faculty-page">
      <h1>Grade Bands</h1>
      <p className="sub">
        Exam-wise grade distribution chart from extracted rows of the selected uploaded dataset.
      </p>

      <div className="faculty-toolbar">
        <label>
          Uploaded dataset
          <SearchableSelect
            value={currentUploadId}
            onChange={onSelectUpload}
            options={uploads.map((u) => ({
              value: u.uploadId,
              label: `${u.classLabel || "Class?"} • ${u.uploadId} • ${new Date(
                u.createdAt
              ).toLocaleString()}`,
            }))}
            disabled={loading || uploads.length === 0}
            placeholder="No Uploads Available"
            searchPlaceholder="Search class, upload ID, or date…"
          />
        </label>
        <label>
          Subject
          <SearchableSelect
            value={subject}
            onChange={setSubject}
            options={subjects.map((s) => ({ value: s, label: subjectDisplayName(s) }))}
            disabled={loading || subjects.length === 0}
            placeholder="No Subject Data"
            searchPlaceholder="Search code or subject name…"
          />
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
        <p className="sub">No uploaded records found. Upload a file first.</p>
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
                  <Bar dataKey="ISE2" fill="#ed8936" name="ISE TUT" />
                  <Bar dataKey="MSE" fill="#9e9e9e" />
                  <Bar dataKey="ESE" fill="#f3c200" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card" style={{ border: "none", marginBottom: 0 }} ref={lineCaptureRef}>
            <h2 style={{ fontSize: "1rem", textAlign: "center", fontWeight: 700 }}>
              Frequency Polygon (Same Distribution)
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
                  <YAxis
                    allowDecimals={false}
                    label={{ value: "No. of students", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="ISE"
                    stroke="#3b6fb6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ISE2"
                    name="ISE TUT"
                    stroke="#ed8936"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="MSE"
                    stroke="#9e9e9e"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ESE"
                    stroke="#f3c200"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
