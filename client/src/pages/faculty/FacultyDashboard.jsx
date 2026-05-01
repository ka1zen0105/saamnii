import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  fetchDashboard,
  fetchExamUpdates,
  fetchMyUploads,
} from "../../api/analyticsApi.js";
import { fetchMyProfile } from "../../api/facultyApi.js";
import { SearchableSelect } from "../../components/SearchableSelect.jsx";
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
      const [dash, myUploads, myProfile, examUpdates] = await Promise.all([
        fetchDashboard(queryParams),
        fetchMyUploads(),
        fetchMyProfile(),
        fetchExamUpdates(),
      ]);
      setDashboard(dash);
      setUploads(Array.isArray(myUploads) ? myUploads : []);
      setProfile(myProfile || null);
      setUpdates(Array.isArray(examUpdates) ? examUpdates : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load dashboard.");
      setDashboard(null);
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
            searchPlaceholder="Search class label…"
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
        </>
      )}
    </div>
  );
}
