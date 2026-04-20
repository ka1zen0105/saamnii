import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchAdminDashboard,
  fetchAdminSettings,
  patchAdminSettings,
} from "../../api/adminApi.js";
import "../../styles/facultyPages.css";
import "../../styles/adminPages.css";

const PIE_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#dc2626",
  "#64748b",
  "#db2777",
  "#0d9488",
];

function formatInt(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function formatPct(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.0%";
  return `${n.toFixed(1)}%`;
}

export function AdminDashboard() {
  const [dash, setDash] = useState(null);
  const [publish, setPublish] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        fetchAdminDashboard(),
        fetchAdminSettings(),
      ]);
      setDash(d);
      setPublish(Boolean(s?.publishResults));
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onPublishChange(checked) {
    setPublish(checked);
    try {
      await patchAdminSettings({ publishResults: checked });
    } catch {
      setPublish(!checked);
    }
  }

  const stats = dash?.stats;
  const gradePie = Object.entries(dash?.gradeDistribution ?? {}).map(
    ([name, value]) => ({ name, value })
  );
  const passFailBars = (dash?.passFailBySubject ?? []).map((r) => ({
    name: r.subjectCode || r.subjectName || "—",
    Pass: r.pass,
    Fail: r.fail,
  }));
  const trend = (dash?.performanceTrend ?? []).map((t) => ({
    label: t.label,
    avgSgpa: t.avgSgpa != null ? Math.round(t.avgSgpa * 1000) / 1000 : null,
  }));
  const uploadPoints = trend.filter((t) => t.avgSgpa != null).length;
  const topFailSubject = [...passFailBars]
    .sort((a, b) => (b.Fail ?? 0) - (a.Fail ?? 0))
    .at(0);

  return (
    <div className="faculty-page admin-page">
      <h1>Dashboard</h1>
      <p className="sub">Institution snapshot, quality trends, and publication controls.</p>

      {err ? (
        <div className="banner banner-error" role="alert">
          {err}
        </div>
      ) : null}

      <div className={`admin-publish-wrap ${publish ? "is-on" : "is-off"}`}>
        <label className="admin-publish">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => onPublishChange(e.target.checked)}
          />
          Publish results to students
        </label>
        <span className="admin-publish-state">
          {publish ? "Live to students" : "Hidden from students"}
        </span>
      </div>

      {loading ? (
        <p className="sub">Loading…</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="label">Total students</div>
              <div className="value">{formatInt(stats?.totalStudents)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Record rows</div>
              <div className="value">{formatInt(stats?.recordRows)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Fail count</div>
              <div className="value">{formatInt(stats?.failCount)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Pass %</div>
              <div className="value">{formatPct(stats?.passPct)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Avg SGPA</div>
              <div className="value">
                {stats?.avgSgpa != null ? Number(stats.avgSgpa).toFixed(2) : "—"}
              </div>
            </div>
          </div>

          <div className="admin-insights">
            <strong>Quick insights</strong>
            <div>
              Upload batches in trend chart: <strong>{formatInt(uploadPoints)}</strong>
            </div>
            <div>
              Highest fail volume subject:{" "}
              <strong>{topFailSubject ? topFailSubject.name : "Not available"}</strong>
            </div>
          </div>

          <div className="chart-card">
            <h2>Grade distribution</h2>
            {gradePie.length === 0 ? (
              <p className="sub">No grade rows available for charting yet.</p>
            ) : null}
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {gradePie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [formatInt(v), "Rows"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h2>Pass vs fail per subject</h2>
            {passFailBars.length === 0 ? (
              <p className="sub">No subject outcomes available for charting yet.</p>
            ) : null}
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={passFailBars}
                  margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(v) => [formatInt(v), "Students"]} />
                  <Legend />
                  <Bar dataKey="Pass" fill="#059669" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Fail" fill="#dc2626" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-card">
            <h2>Performance trend (by upload batch order)</h2>
            <p className="chart-hint">
              Each point is one uploaded batch&apos;s average SGPA, ordered by upload time.
            </p>
            {trend.length === 0 ? (
              <p className="sub">No upload trend data available yet.</p>
            ) : null}
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, "auto"]} />
                  <Tooltip formatter={(v) => [Number(v).toFixed(2), "Avg SGPA"]} />
                  <Line
                    type="monotone"
                    dataKey="avgSgpa"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
