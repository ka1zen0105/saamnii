import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./LandingPage.css";

export function LandingPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("faculty");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!userId.trim()) {
      setError("Enter your user id.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    try {
      await login(userId.trim(), role, password);
      navigate(role === "admin" ? "/admin/dashboard" : "/faculty/dashboard", {
        replace: true,
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Sign in failed. Check credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing">
      <header className="landing-header">
        <span className="landing-logo">ExamGrade</span>
        <p className="landing-tagline">Exam grade analysis for your institution</p>
      </header>

      <div className="landing-single">
        <article className="landing-card landing-card-single">
          <h2 className="landing-card-title">Sign in</h2>
          <p className="landing-card-desc">
            Choose your role, then enter your user id and password.
          </p>

          {error ? (
            <p className="landing-error landing-error-inline" role="alert">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="landing-form">
            <label className="landing-label" htmlFor="login-role">
              Role
            </label>
            <select
              id="login-role"
              className="landing-input landing-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={loading}
            >
              <option value="faculty">Faculty</option>
              <option value="admin">Admin / HOD</option>
            </select>

            <label className="landing-label" htmlFor="login-userId">
              User id
            </label>
            <input
              id="login-userId"
              className="landing-input"
              type="text"
              autoComplete="username"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={loading}
              placeholder={role === "admin" ? "Admin id" : "Faculty id"}
            />

            <label className="landing-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="landing-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
            />

            <button type="submit" className="landing-submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </article>
      </div>
    </div>
  );
}
