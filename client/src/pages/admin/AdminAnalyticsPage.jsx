import { useCallback, useEffect, useMemo, useState } from "react";
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
import { fetchAdminDashboard, fetchAdminMeta } from "../../api/adminApi.js";
import {
  fetchBellCurve,
  fetchExamProgression,
  fetchSubjectAvg,
} from "../../api/analyticsApi.js";
import "../../styles/facultyPages.css";
import "../../styles/adminPages.css";

async function mergeBellCurves(baseParams, subjectCodes, exam) {
  const ex = exam || "total";
  if (!subjectCodes.length) return [];
  const results = await Promise.all(
    subjectCodes.map((subjectCode) =>
      fetchBellCurve({ ...baseParams, subjectCode, exam: ex }).catch(() => null)
    )
  );
  let template = null;
  for (const r of results) {
    if (r && Array.isArray(r) && r.length) {
      template = r.map((b) => ({ percentage: b.percentage, count: 0 }));
      break;
    }
  }
  if (!template) return [];
  for (const r of results) {
    if (!r || !Array.isArray(r)) continue;
    r.forEach((b, i) => {
      if (template[i]) template[i].count += b.count ?? 0;
    });
  }
  return template;
}

export function AdminAnalyticsPage() {
  const [dash, setDash] = useState(null);
  const [meta, setMeta] = useState({ classes: [], subjectCodes: [] });

  const [aSubjectAvg, setASubjectAvg] = useState([]);
  const [aProgression, setAProgression] = useState([]);
  const [aBell, setABell] = useState([]);

  const [bClass, setBClass] = useState("");
  const [bSubject, setBSubject] = useState("");
  const [bExam, setBExam] = useState("total");
  const [bSubjectAvg, setBSubjectAvg] = useState([]);
  const [bProgression, setBProgression] = useState([]);
  const [bBell, setBBell] = useState([]);

  const [loadingA, setLoadingA] = useState(true);
  const [loadingB, setLoadingB] = useState(true);
  const [err, setErr] = useState("");

  const bParams = useMemo(() => {
    const p = {};
    if (bClass) p.classLabel = bClass;
    return p;
  }, [bClass]);

  const loadSectionA = useCallback(async () => {
    setErr("");
    setLoadingA(true);
    try {
      const [d, m, subj, prog] = await Promise.all([
        fetchAdminDashboard(),
        fetchAdminMeta(),
        fetchSubjectAvg({}),
        fetchExamProgression({}),
      ]);
      setDash(d);
      setMeta(m);
      setASubjectAvg(Array.isArray(subj) ? subj : []);
      setAProgression(Array.isArray(prog) ? prog : []);

      const codes = m?.subjectCodes?.length
        ? m.subjectCodes
        : (Array.isArray(subj) ? subj : []).map((s) => s.subjectCode).filter(Boolean);
      const bell = await mergeBellCurves({}, codes, "total");
      setABell(bell);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load section A.");
    } finally {
      setLoadingA(false);
    }
  }, []);

  const loadSectionB = useCallback(async () => {
    setLoadingB(true);
    try {
      const [subj, prog] = await Promise.all([
        fetchSubjectAvg(bParams),
        fetchExamProgression(bParams),
      ]);
      setBSubjectAvg(Array.isArray(subj) ? subj : []);
      let progList = Array.isArray(prog) ? prog : [];
      if (bSubject) {
        progList = progList.filter((p) => (p.subjectCode || "") === bSubject);
      }
      setBProgression(progList);

      let bell;
      if (bSubject) {
        bell = await fetchBellCurve({
          ...bParams,
          subjectCode: bSubject,
          exam: bExam,
        });
      } else {
        const codes =
          meta.subjectCodes?.length > 0
            ? meta.subjectCodes
            : (Array.isArray(subj) ? subj : []).map((s) => s.subjectCode).filter(Boolean);
        bell = await mergeBellCurves(bParams, codes, bExam);
      }
      setBBell(Array.isArray(bell) ? bell : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load filtered charts.");
      setBBell([]);
    } finally {
      setLoadingB(false);
    }
  }, [bParams, bSubject, bExam, meta.subjectCodes]);

  useEffect(() => {
    loadSectionA();
  }, [loadSectionA]);

  useEffect(() => {
    loadSectionB();
  }, [loadSectionB]);

  const statsA = dash?.stats;

  const barCombined = useMemo(() => {
    return aSubjectAvg.map((s) => ({
      name: s.subjectCode || s.subjectName || "—",
      avg: s.avgTotal != null && Number.isFinite(s.avgTotal) ? Math.round(s.avgTotal * 100) / 100 : 0,
    }));
  }, [aSubjectAvg]);

  const lineCombined = useMemo(() => {
    return aProgression.map((p) => ({
      name: p.subjectCode || p.subjectName || "—",
      ISE: p.avgIse != null ? Math.round(p.avgIse * 100) / 100 : null,
      MSE: p.avgMse != null ? Math.round(p.avgMse * 100) / 100 : null,
      ESE: p.avgEse != null ? Math.round(p.avgEse * 100) / 100 : null,
    }));
  }, [aProgression]);

  const barFiltered = useMemo(() => {
    let list = bSubjectAvg;
    if (bSubject) {
      list = list.filter((s) => (s.subjectCode || "") === bSubject);
    }
    return list.map((s) => ({
      name: s.subjectCode || s.subjectName || "—",
      avg: s.avgTotal != null && Number.isFinite(s.avgTotal) ? Math.round(s.avgTotal * 100) / 100 : 0,
    }));
  }, [bSubjectAvg, bSubject]);

  const lineFiltered = useMemo(() => {
    return bProgression.map((p) => ({
      name: p.subjectCode || p.subjectName || "—",
      ISE: p.avgIse != null ? Math.round(p.avgIse * 100) / 100 : null,
      MSE: p.avgMse != null ? Math.round(p.avgMse * 100) / 100 : null,
      ESE: p.avgEse != null ? Math.round(p.avgEse * 100) / 100 : null,
    }));
  }, [bProgression]);

  return (
    <div className="faculty-page admin-page">
      <h1>Analytics</h1>
      <p className="sub">Institution-wide analytics and filtered drill-down.</p>

      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      <h2 className="section-title">Section A — Combined (all classes &amp; subjects)</h2>
      {loadingA ? (
        <p className="sub">Loading section A…</p>
      ) : (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
            <div className="stat-card">
              <div className="label">Avg SGPA</div>
              <div className="value">
                {statsA?.avgSgpa != null ? statsA.avgSgpa : "—"}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Subjects count</div>
              <div className="value">{statsA?.subjectsCount ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="label">Rows count</div>
              <div className="value">{statsA?.recordRows ?? 0}</div>
            </div>
          </div>

          <div className="chart-card">
            <h2>Subject average (combined)</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barCombined} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#2563eb" radius={[4, 4, 0, 0]} name="Avg total marks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h2>Exam averages (combined)</h2>
            <p className="chart-hint">Per subject: average ISE / MSE / ESE as % where available.</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineCombined} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ISE" stroke="#2563eb" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="MSE" stroke="#7c3aed" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="ESE" stroke="#059669" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h2>Bell curve (combined)</h2>
            <p className="chart-hint">Total % pooled across all subjects.</p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aBell} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="percentage" tick={{ fontSize: 9 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <h2 className="section-title">Section B — Filtered</h2>
      <div className="faculty-toolbar">
        <label>
          Class
          <select value={bClass} onChange={(e) => setBClass(e.target.value)}>
            <option value="">All classes</option>
            {meta.classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subject
          <select value={bSubject} onChange={(e) => setBSubject(e.target.value)}>
            <option value="">All subjects</option>
            {meta.subjectCodes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exam (bell curve)
          <select value={bExam} onChange={(e) => setBExam(e.target.value)}>
            <option value="total">Total %</option>
            <option value="ise">ISE %</option>
            <option value="ese">ESE %</option>
          </select>
        </label>
      </div>

      {loadingB ? (
        <p className="sub">Loading filtered charts…</p>
      ) : (
        <>
          <div className="chart-card">
            <h2>Subject average (filtered)</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barFiltered} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h2>Exam averages (filtered)</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineFiltered} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ISE" stroke="#2563eb" dot strokeWidth={2} />
                  <Line type="monotone" dataKey="MSE" stroke="#7c3aed" dot strokeWidth={2} />
                  <Line type="monotone" dataKey="ESE" stroke="#059669" dot strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h2>Bell curve (filtered)</h2>
            <p className="chart-hint">
              {bSubject
                ? `Single subject — ${bExam.toUpperCase()}`
                : "All subjects in scope merged by bucket."}
            </p>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bBell} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="percentage" tick={{ fontSize: 9 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#db2777" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
