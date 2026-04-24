import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  fetchBellCurve,
  fetchDashboard,
  fetchExamUpdates,
  fetchExamProgression,
  fetchMyUploads,
} from "../../api/analyticsApi.js";
import { fetchMyProfile } from "../../api/facultyApi.js";
import { addNormalCurveOverlay } from "../../lib/bellCurve.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
import { subjectDisplayName } from "../../utils/subjectLabel.js";
import "../../styles/facultyPages.css";

function mean(nums) {
  const v = nums.filter((n) => n != null && Number.isFinite(n));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function FacultyDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const classes = isAdmin ? [] : (user?.assignedClasses ?? []);

  const [classLabel, setClassLabel] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [progression, setProgression] = useState([]);
  const [bellSubject, setBellSubject] = useState("");
  const [bellData, setBellData] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [profile, setProfile] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const queryParams = useMemo(() => {
    const p = {};
    if (classLabel) p.classLabel = classLabel;
    return p;
  }, [classLabel]);

  const loadCore = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [dash, prog, myUploads, myProfile, examUpdates] = await Promise.all([
        fetchDashboard(queryParams),
        fetchExamProgression(queryParams),
        fetchMyUploads(),
        fetchMyProfile(),
        fetchExamUpdates(),
      ]);
      setDashboard(dash);
      setProgression(Array.isArray(prog) ? prog : []);
      setUploads(Array.isArray(myUploads) ? myUploads : []);
      setProfile(myProfile || null);
      setUpdates(Array.isArray(examUpdates) ? examUpdates : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load dashboard.");
      setDashboard(null);
      setProgression([]);
      setUploads([]);
      setProfile(null);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    const subs = dashboard?.subjectAvgPercentage ?? [];
    if (!subs.length) return;
    setBellSubject((prev) => {
      if (prev) return prev;
      const code = subs.find((s) => s.subjectCode)?.subjectCode;
      return code || prev;
    });
  }, [dashboard]);

  useEffect(() => {
    if (!bellSubject) {
      setBellData([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = { ...queryParams, subjectCode: bellSubject, exam: "total" };
        const raw = await fetchBellCurve(params);
        if (!cancelled) {
          setBellData(addNormalCurveOverlay(raw));
        }
      } catch {
        if (!cancelled) setBellData([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryParams, bellSubject]);

  const subjectBars = dashboard?.subjectAvgPercentage ?? [];
  const avgPctAcrossSubjects = mean(subjectBars.map((s) => s.avgPercentage));

  const statRecords = dashboard?.totalStudents ?? 0;
  const statAvgPct =
    avgPctAcrossSubjects != null ? Math.round(avgPctAcrossSubjects * 100) / 100 : "—";
  const statFail = dashboard?.failCount ?? 0;
  const statPassRate = dashboard
    ? `${Math.round((dashboard.passRate ?? 0) * 10000) / 100}%`
    : "—";
  const assignedClasses = profile?.assignedClasses?.length || classes.length || 0;
  const assignedSubjects = profile?.subjectCodes?.length || 0;
  const profileCompletion = [
    Boolean(profile?.displayLabel),
    Boolean(profile?.email),
    Boolean(profile?.contact),
  ].filter(Boolean).length;
  const profileCompletionPct = Math.round((profileCompletion / 3) * 100);

  const lineData = progression.map((r) => ({
    name: r.subjectCode || r.subjectName || "—",
    ISE: r.avgIse != null ? Math.round(r.avgIse * 100) / 100 : null,
    MSE: r.avgMse != null ? Math.round(r.avgMse * 100) / 100 : null,
    ESE: r.avgEse != null ? Math.round(r.avgEse * 100) / 100 : null,
  }));

  return (
    <div className="faculty-page">
      <h1>Dashboard</h1>
      <p className="sub">
        {isAdmin
          ? "Institution-wide metrics from all uploaded student records."
          : "Overview for your assigned classes."}
      </p>

      <div className="faculty-toolbar">
        <label>
          Class
          <SearchableSelect
            value={classLabel}
            onChange={setClassLabel}
            options={classes.map((c) => ({ value: c, label: c }))}
            placeholder={isAdmin ? "All Classes" : "All Assigned Classes"}
            searchPlaceholder="Search Class..."
          />
        </label>
        <label>
          Bell curve subject
          <SearchableSelect
            value={bellSubject}
            onChange={setBellSubject}
            options={subjectBars.map((s) => ({
              value: s.subjectCode,
              label: subjectDisplayName(s.subjectName || s.subjectCode),
            }))}
            placeholder="Select Subject"
            searchPlaceholder="Search Subject..."
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
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="label">Records</div>
              <div className="value">{statRecords}</div>
            </div>
            <div className="stat-card">
              <div className="label">Avg %</div>
              <div className="value">{statAvgPct}</div>
            </div>
            <div className="stat-card">
              <div className="label">Fail count</div>
              <div className="value">{statFail}</div>
            </div>
            <div className="stat-card">
              <div className="label">Pass rate</div>
              <div className="value">{statPassRate}</div>
            </div>
            <div className="stat-card">
              <div className="label">My uploads</div>
              <div className="value">{uploads.length}</div>
            </div>
            <div className="stat-card">
              <div className="label">Assigned classes</div>
              <div className="value">{assignedClasses}</div>
            </div>
            <div className="stat-card">
              <div className="label">Assigned subjects</div>
              <div className="value">{assignedSubjects}</div>
            </div>
            <div className="stat-card">
              <div className="label">Profile completion</div>
              <div className="value">{Number.isFinite(profileCompletionPct) ? `${profileCompletionPct}%` : "—"}</div>
            </div>
          </div>

          <div className="chart-card">
            <h2>Academic exam updates</h2>
            {updates.length === 0 ? (
              <p className="sub">No published updates yet.</p>
            ) : (
              updates.slice(0, 5).map((u, idx) => (
                <p key={`${u.createdAt || idx}-${idx}`} className="chart-hint" style={{ margin: "0.3rem 0" }}>
                  - {u.message}
                </p>
              ))
            )}
          </div>

          <div className="chart-card">
            <h2>Subject-wise average %</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectBars.map((s) => ({
                    name: s.subjectCode || s.subjectName || "—",
                    avg: s.avgPercentage != null ? Math.round(s.avgPercentage * 100) / 100 : 0,
                  }))}
                  margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`${v}%`, "Avg"]} />
                  <Bar dataKey="avg" fill="#2563eb" radius={[4, 4, 0, 0]} name="Avg %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h2>Exam progression (avg ISE → MSE → ESE % per subject)</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="ISE" stroke="#2563eb" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="MSE" stroke="#7c3aed" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="ESE" stroke="#059669" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h2>Score distribution (total %) with normal curve</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={bellData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="count"
                    fill="#93c5fd"
                    name="Count"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="curve"
                    stroke="#1d4ed8"
                    strokeWidth={2}
                    dot={false}
                    name="Normal curve"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
