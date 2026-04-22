import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import "./LandingPage.css";

export function LandingPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setLoading(true);
    try {
      const auth = await login(email.trim(), password);
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
        <p className="landing-tagline">Exam grade analysis for your institution</p>
      </header>

      <div className="landing-single">
        <article className="landing-card landing-card-single">
          <h2 className="landing-card-title">Sign in</h2>
          <p className="landing-card-desc">
            Enter your mentor email and password.
          </p>

          {error ? (
            <p className="landing-error landing-error-inline" role="alert">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="landing-form">
            <label className="landing-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="landing-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="name@college.edu"
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
