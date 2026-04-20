import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchGradeBands } from "../../api/analyticsApi.js";
import "../../styles/facultyPages.css";

export function GradeBandsPage() {
  const { user } = useAuth();
  const classes = user?.assignedClasses ?? [];
  const assignedSubjects = useMemo(() => {
    return new Set((user?.subjectCodes ?? []).map((c) => String(c).trim()).filter(Boolean));
  }, [user?.subjectCodes]);

  const [classLabel, setClassLabel] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const raw = await fetchGradeBands(classLabel ? { classLabel } : {});
      const list = Array.isArray(raw) ? raw : [];
      const allCodes = list
        .map((d) => String(d?.subjectCode ?? "").trim())
        .filter(Boolean);
      const allowed = Array.from(assignedSubjects);
      const options = allowed.length ? allCodes.filter((c) => assignedSubjects.has(c)) : allCodes;
      setSubjectOptions(options);

      const active = subjectCode || options[0] || "";
      if (!subjectCode && active) {
        setSubjectCode(active);
      }
      if (!active) {
        setData(null);
        return;
      }

      const match = list.find((d) => String(d.subjectCode ?? "").trim() === active) || null;
      setData(match);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load grade bands.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [classLabel, subjectCode, assignedSubjects]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!subjectCode && assignedSubjects.size > 0) {
      const first = Array.from(assignedSubjects)[0];
      setSubjectCode(first);
      setSubjectOptions(Array.from(assignedSubjects));
    }
  }, [subjectCode, assignedSubjects]);

  return (
    <div className="faculty-page">
      <h1>Grade bands</h1>
      <p className="sub">Bar graph and scatter plot for your assigned subject only.</p>

      <div className="faculty-toolbar">
        <label>
          Class
          <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>
            <option value="">All assigned</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <select
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value)}
            disabled={subjectOptions.length === 0}
          >
            {subjectOptions.length === 0 ? <option value="">No subject assigned</option> : null}
            {subjectOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      {loading ? (
        <p className="sub">Loading…</p>
      ) : !subjectCode ? (
        <p className="sub">No subject data found for this class scope.</p>
      ) : !data ? (
        <p className="sub">No grade-band data found for selected subject.</p>
      ) : (
        <SubjectBandSection subject={data} />
      )}
    </div>
  );
}

function SubjectBandSection({ subject }) {
  const captureRef = useRef(null);

  const rows = (subject.bands ?? []).map((b) => ({
    band: b.gradeSymbol,
    label: b.label,
    ISE: b.ise,
    MSE: b.mse,
    ESE: b.ese,
    Total: b.total,
  }));

  const scatterRows = rows.map((r, idx) => ({
    x: idx + 1,
    label: r.label,
    ISE: r.ISE,
    MSE: r.MSE,
    ESE: r.ESE,
    Total: r.Total,
  }));

  async function handlePng() {
    const el = captureRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      const safe = (subject.subjectCode || "subject").replace(/[^\w-]+/g, "_");
      a.download = `grade-bands-${safe}.png`;
      a.click();
    } catch {
      /* ignore */
    }
  }

  const title = subject.subjectCode
    ? `${subject.subjectCode} — ${subject.subjectName}`
    : subject.subjectName || "Subject";

  return (
    <section className="grade-band-block">
      <div className="grade-band-head">
        <h2>{title}</h2>
        <button type="button" className="btn-png" onClick={handlePng}>
          Download PNG
        </button>
      </div>

      <div ref={captureRef} className="chart-capture">
        <div className="chart-card" style={{ border: "none", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "0.9rem" }}>Counts by band (grouped)</h2>
          <div className="chart-wrap" style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ISE" fill="#2563eb" name="ISE" />
                <Bar dataKey="MSE" fill="#7c3aed" name="MSE" />
                <Bar dataKey="ESE" fill="#059669" name="ESE" />
                <Bar dataKey="Total" fill="#d97706" name="Total %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card" style={{ border: "none", marginBottom: 0 }}>
          <h2 style={{ fontSize: "0.9rem" }}>Scatter plot by band</h2>
          <div className="chart-wrap" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  dataKey="x"
                  tick={{ fontSize: 11 }}
                  domain={[1, 8]}
                  allowDecimals={false}
                  label={{ value: "Range of Percentage Marks", position: "insideBottom", offset: -4 }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value, key, payload) => [value, key]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
                />
                <Legend />
                <Scatter data={scatterRows} dataKey="ISE" name="ISE" fill="#2563eb" />
                <Scatter data={scatterRows} dataKey="MSE" name="MSE" fill="#f97316" />
                <Scatter data={scatterRows} dataKey="ESE" name="ESE" fill="#64748b" />
                <Scatter data={scatterRows} dataKey="Total" name="Total %" fill="#eab308" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
