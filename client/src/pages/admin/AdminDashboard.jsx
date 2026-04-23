import { useCallback, useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  createAdminExamUpdate,
  fetchAdminDashboard,
  fetchAdminExamUpdates,
  fetchFacultyOGradeDistribution,
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
  const [updates, setUpdates] = useState([]);
  const [facultyOPie, setFacultyOPie] = useState([]);
  const [newUpdate, setNewUpdate] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [d, u, oDist] = await Promise.all([
        fetchAdminDashboard(),
        fetchAdminExamUpdates(),
        fetchFacultyOGradeDistribution(),
      ]);
      setDash(d);
      setUpdates(Array.isArray(u) ? u : []);
      setFacultyOPie(Array.isArray(oDist) ? oDist : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = dash?.stats;
  const gradePie = facultyOPie.map((r) => ({
    name: r.facultyLabel || r.facultyId,
    percentage: Number(r.oPercentage || 0),
    oCount: Number(r.oCount || 0),
    total: Number(r.total || 0),
    facultyId: r.facultyId,
  }));
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

  async function onPublishUpdate(e) {
    e.preventDefault();
    const msg = String(newUpdate || "").trim();
    if (!msg) return;
    setPublishing(true);
    setErr("");
    try {
      const data = await createAdminExamUpdate(msg);
      setUpdates(Array.isArray(data?.updates) ? data.updates : []);
      setNewUpdate("");
    } catch (e2) {
      setErr(e2?.response?.data?.message || e2?.message || "Failed to publish update.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="faculty-page admin-page">
      <h1>Dashboard</h1>

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

          <div className="admin-two-col">
            <div className="chart-card">
              <h2>Academic exam related updates</h2>
              <form onSubmit={onPublishUpdate} style={{ marginBottom: "0.75rem" }}>
                <label style={{ display: "block", fontSize: "0.82rem", color: "#4b5563", marginBottom: "0.35rem" }}>
                  Publish new update
                </label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    value={newUpdate}
                    onChange={(e) => setNewUpdate(e.target.value)}
                    placeholder="e.g. Sem-3 re-evaluation schedule published."
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.65rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.45rem",
                      fontSize: "0.86rem",
                    }}
                  />
                  <button
                    type="submit"
                    className="btn-primary-sm"
                    disabled={publishing || !newUpdate.trim()}
                  >
                    {publishing ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </form>
              <div style={{ marginTop: "0.65rem" }}>
                {updates.length === 0 ? (
                  <p className="sub">No published updates yet.</p>
                ) : (
                  updates.slice(0, 5).map((u, idx) => (
                    <div key={`${u.createdAt || idx}-${idx}`} className="chart-hint" style={{ margin: "0.28rem 0" }}>
                      - {u.message}
                    </div>
                  ))
                )}
              </div>
              <p className="chart-hint" style={{ marginTop: "0.5rem" }}>
                Latest exam updates are based on uploaded datasets. Use Analysis and Analytics
                sections to drill into faculty-wise performance and bell curves.
              </p>
            </div>

            <div className="chart-card">
              <h2>Faculty-wise O grade percentage</h2>
              {gradePie.length === 0 ? (
                <p className="sub">No faculty O-grade data available for selected filters.</p>
              ) : null}
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={gradePie}
                    dataKey="percentage"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                    label={({ name, value }) => `${name} ${Number(value).toFixed(1)}%`}
                    >
                      {gradePie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  <Tooltip
                    formatter={(v, _name, item) => [
                      `${Number(v).toFixed(2)}%`,
                      `O: ${item?.payload?.oCount ?? 0} / ${item?.payload?.total ?? 0}`,
                    ]}
                  />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
