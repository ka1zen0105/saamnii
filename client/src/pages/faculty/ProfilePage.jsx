import { useCallback, useEffect, useState } from "react";
import { fetchMyProfile, patchMyProfile } from "../../api/facultyApi.js";
import "../../styles/facultyPages.css";

export function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ type: "", text: "" });
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    displayLabel: "",
    email: "",
    contact: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setBanner({ type: "", text: "" });
    try {
      const data = await fetchMyProfile();
      setProfile(data);
      setForm((prev) => ({
        ...prev,
        displayLabel: data?.displayLabel || "",
        email: data?.email || "",
        contact: data?.contact || "",
      }));
    } catch (e) {
      setBanner({
        type: "error",
        text: e?.response?.data?.message || e.message || "Failed to load faculty profile.",
      });
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBanner({ type: "", text: "" });
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setBanner({ type: "error", text: "Password and confirm password do not match." });
      return;
    }
    const body = {
      displayLabel: form.displayLabel,
      email: form.email,
      contact: form.contact,
    };
    if (form.newPassword) {
      body.currentPassword = form.currentPassword;
      body.newPassword = form.newPassword;
    }
    setSaving(true);
    try {
      const updated = await patchMyProfile(body);
      setProfile(updated);
      setForm((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setBanner({ type: "success", text: "Profile updated successfully." });
    } catch (e) {
      setBanner({
        type: "error",
        text: e?.response?.data?.message || e.message || "Failed to update profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  function resetEditableFields() {
    if (!profile) return;
    setForm((prev) => ({
      ...prev,
      displayLabel: profile.displayLabel || "",
      email: profile.email || "",
      contact: profile.contact || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }));
    setBanner({ type: "success", text: "Unsaved changes were reset." });
  }

  function clearLocalSelections() {
    try {
      localStorage.removeItem("faculty_last_upload_id");
      setBanner({ type: "success", text: "Local faculty upload selection was cleared." });
    } catch {
      setBanner({ type: "error", text: "Could not clear local data." });
    }
  }

  return (
    <div className="faculty-page">
      <h1>Faculty Profile</h1>
      <p className="sub">Manage Your Profile Details and Password.</p>

      {banner.type ? (
        <div
          className={`banner ${banner.type === "success" ? "banner-success" : "banner-error"}`}
          role="status"
        >
          {banner.text}
        </div>
      ) : null}

      {loading ? (
        <p className="sub">Loading…</p>
      ) : (
        <>
          <div className="stats-row">
            <span>User ID: {profile?.userId || "—"}</span>
            <span>Assigned classes: {(profile?.assignedClasses || []).join(", ") || "—"}</span>
            <span>Subjects: {(profile?.subjectCodes || []).join(", ") || "—"}</span>
          </div>

          <div className="profile-actions">
            <button type="button" className="btn-muted" onClick={load} disabled={saving}>
              Refresh Profile
            </button>
            <button type="button" className="btn-muted" onClick={resetEditableFields} disabled={saving}>
              Reset Form
            </button>
            <button type="button" className="btn-danger" onClick={clearLocalSelections} disabled={saving}>
              Clear Local Upload Selection
            </button>
          </div>

          <form className="faculty-form-grid" onSubmit={onSubmit}>
            <fieldset>
              <legend>Edit Profile</legend>
              <label htmlFor="profile-displayLabel">Display Name</label>
              <input
                id="profile-displayLabel"
                name="displayLabel"
                value={form.displayLabel}
                onChange={onChange}
                disabled={saving}
              />

              <label htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                disabled={saving}
              />

              <label htmlFor="profile-contact">Contact</label>
              <input
                id="profile-contact"
                name="contact"
                value={form.contact}
                onChange={onChange}
                disabled={saving}
              />

              <label htmlFor="profile-currentPassword">Current Password (Required to Change Password)</label>
              <input
                id="profile-currentPassword"
                name="currentPassword"
                type="password"
                value={form.currentPassword}
                onChange={onChange}
                disabled={saving}
                placeholder="Enter current password"
              />

              <label htmlFor="profile-newPassword">New Password (Optional)</label>
              <input
                id="profile-newPassword"
                name="newPassword"
                type="password"
                value={form.newPassword}
                onChange={onChange}
                disabled={saving}
                placeholder="At least 6 characters"
              />

              <label htmlFor="profile-confirmPassword">Confirm New Password</label>
              <input
                id="profile-confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={onChange}
                disabled={saving}
              />

              <button type="submit" className="btn-primary-sm" disabled={saving}>
                {saving ? "Saving…" : "Save Profile"}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </div>
  );
}

