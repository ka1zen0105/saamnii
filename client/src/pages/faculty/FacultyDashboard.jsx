import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchExamUpdates, fetchMyUploads } from "../../api/analyticsApi.js";
import { fetchMyProfile } from "../../api/facultyApi.js";
import "../../styles/facultyPages.css";

export function FacultyDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const classes = isAdmin ? [] : (user?.assignedClasses ?? []);

  const [uploads, setUploads] = useState([]);
  const [profile, setProfile] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const loadCore = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const [myUploads, myProfile, examUpdates] = await Promise.all([
        fetchMyUploads(),
        fetchMyProfile(),
        fetchExamUpdates(),
      ]);
      setUploads(Array.isArray(myUploads) ? myUploads : []);
      setProfile(myProfile || null);
      setUpdates(Array.isArray(examUpdates) ? examUpdates : []);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to load dashboard.");
      setUploads([]);
      setProfile(null);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

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
