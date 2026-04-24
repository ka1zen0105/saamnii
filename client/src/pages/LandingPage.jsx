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

  const previewId = identifier.trim() || "sign-in";

  return (
    <div className="hl-page">
      <div className="hl-container">
        <nav className="hl-nav" aria-label="Primary">
          <div className="hl-nav-left">
            <div className="hl-nav-logo-wrap">
              <img
                className="hl-nav-logo-img"
                src="/fr-crce-logo.png"
                width={1024}
                height={394}
                alt=""
                decoding="async"
              />
            </div>
            <div className="hl-nav-brand-block">
              <span className="hl-nav-brand-title">GradeX</span>
              <span className="hl-nav-brand-sub">Fr. CRCE</span>
            </div>
          </div>
          <div className="hl-nav-links">
            <span className="hl-nav-link is-static">Home</span>
            <a className="hl-nav-link" href="#signin">
              Sign in
            </a>
          </div>
          <div className="hl-nav-right">
            <a className="hl-nav-cta" href="#signin">
              Try it out
            </a>
          </div>
        </nav>

        <section className="hl-home" aria-labelledby="hl-hero-title">
          <div className="hl-brand-card">
            <img
              className="hl-brand-logo"
              src="/fr-crce-logo.png"
              width={1024}
              height={394}
              alt="Fr. Conceicao Rodrigues College of Engineering (Fr. CRCE). Moulding engineers who can build the nation."
            />
            <p className="hl-brand-tagline">GradeX · Analytics</p>
          </div>
          <h1 id="hl-hero-title" className="hl-hero-title">
            GradeX
          </h1>
          <p className="hl-hero-sub">
            Tired of scattered spreadsheets? One place to upload semester marks, explore
            analytics, and keep faculty and admin workflows in sync.
          </p>
        </section>

        <section className="hl-features" aria-label="Product highlights">
          <article className="hl-feature-box">
            <div className="hl-feature-top">
              <div className="hl-feature-pill">gradex/upload</div>
            </div>
            <p className="hl-feature-bottom">
              Upload structured Excel files and keep every cohort in one secure workspace.
            </p>
          </article>
          <article className="hl-feature-box">
            <div className="hl-feature-top">
              <div className="hl-feature-lines" aria-hidden="true">
                <div className="hl-feature-line-row">
                  <span className="hl-line" />
                </div>
                <div className="hl-feature-line-row">
                  <span className="hl-line" />
                </div>
                <div className="hl-feature-line-row">
                  <span className="hl-line" />
                </div>
              </div>
            </div>
            <p className="hl-feature-bottom">
              A calm dashboard layout that scales from laptops to phones without losing context.
            </p>
          </article>
          <article className="hl-feature-box">
            <div className="hl-feature-top">
              <div className="hl-feature-swatch" aria-hidden="true">
                <span className="hl-swatch-icon" />
                <span className="hl-swatch-bar hl-swatch-bar-a" />
                <span className="hl-swatch-bar hl-swatch-bar-b" />
              </div>
            </div>
            <p className="hl-feature-bottom">
              Role-aware views for faculty and administrators with the same underlying data.
            </p>
          </article>
        </section>

        <div id="signin" />
        <section className="hl-signup" aria-labelledby="hl-signup-heading">
          <div className="hl-signup-left">
            <div className="hl-signup-copy">
              <h2 id="hl-signup-heading" className="hl-signup-title">
                Sign in and analyse
              </h2>
              <p className="hl-signup-desc">
                Use your college email or user ID with your password—the same credentials as
                before. You will land on the faculty or admin workspace automatically.
              </p>
            </div>
          </div>
          <div className="hl-signup-right">
            <article className="hl-signup-card">
              <div className="hl-signup-card-header">
                <div className="hl-signup-avatar" aria-hidden="true">
                  EG
                </div>
                <div className="hl-signup-card-heading">gradex/{previewId}</div>
              </div>

              {error ? (
                <p className="hl-signup-error" role="alert">
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleSubmit} className="hl-signup-form">
                <label className="hl-signup-label" htmlFor="login-identifier">
                  Email or User ID
                </label>
                <input
                  id="login-identifier"
                  className="hl-signup-input"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  placeholder="name@college.edu or faculty-prof"
                />

                <label className="hl-signup-label" htmlFor="login-password">
                  Password
                </label>
                <input
                  id="login-password"
                  className="hl-signup-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="••••••••"
                />

                <button type="submit" className="hl-signup-submit" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </article>
          </div>
        </section>

        <footer className="hl-footer">
          <div className="hl-footer-left">
            <div className="hl-footer-top">
              <div className="hl-footer-brand">GradeX</div>
              <div className="hl-footer-actions">
                <a className="hl-footer-btn hl-footer-btn-primary" href="#signin">
                  Try now
                </a>
                <a
                  className="hl-footer-btn hl-footer-btn-secondary"
                  href="https://frcrce.ac.in/"
                  target="_blank"
                  rel="noreferrer"
                >
                  College site
                </a>
              </div>
            </div>
          </div>
          <div className="hl-footer-right">
            <div className="hl-footer-note">GradeX · Fr. CRCE</div>
          </div>
        </footer>
        <p className="hl-last-line">
          Built for Fr. Conceicao Rodrigues College of Engineering
        </p>
      </div>
    </div>
  );
}
