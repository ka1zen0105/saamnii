import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./LandingPage.css";

export function LandingPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) {
      setError("Enter your email or user ID.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    try {
      const auth = await login(identifier.trim(), password);
      navigate(
        auth?.user?.role === "admin" ? "/admin/dashboard" : "/faculty/dashboard",
        { replace: true }
      );
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
        <p className="landing-tagline">Exam Grade Analysis for Your Institution</p>
      </header>

      <div className="landing-single">
        <article className="landing-card landing-card-single">
          <h2 className="landing-card-title">Sign In</h2>
          <p className="landing-card-desc">
            Enter Your Email or User ID and Password.
          </p>

          {error ? (
            <p className="landing-error landing-error-inline" role="alert">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="landing-form">
            <label className="landing-label" htmlFor="login-identifier">
              Email or User ID
            </label>
            <input
              id="login-identifier"
              className="landing-input"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              placeholder="name@college.edu or faculty-prof"
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
              {loading ? "Signing In…" : "Sign In"}
            </button>
          </form>
        </article>
      </div>
    </div>
  );
}
