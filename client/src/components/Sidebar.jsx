import { NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import "./Sidebar.css";

/**
 * @param {object} props
 * @param {string} props.title
 * @param {{ to: string, label: string }[]} props.links
 * @param {() => void} props.onLogout
 */
export function Sidebar({ title, links, onLogout }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sidebar">
      <div className="sidebar-brand">
        <div>
          <span className="sidebar-brand-mark">ExamGrade</span>
          <span className="sidebar-brand-sub">{title}</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="Main">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-actions">
        <button
          type="button"
          className={`sidebar-theme-toggle-switch ${isDark ? "is-dark" : "is-light"}`}
          onClick={toggleTheme}
          aria-label={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
          title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
        >
          <span className="toggle-icon toggle-sun" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <circle cx="12" cy="12" r="4.2" fill="currentColor" />
              <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="12" y1="1.8" x2="12" y2="5.1" />
                <line x1="12" y1="18.9" x2="12" y2="22.2" />
                <line x1="1.8" y1="12" x2="5.1" y2="12" />
                <line x1="18.9" y1="12" x2="22.2" y2="12" />
                <line x1="4.6" y1="4.6" x2="6.9" y2="6.9" />
                <line x1="17.1" y1="17.1" x2="19.4" y2="19.4" />
                <line x1="17.1" y1="6.9" x2="19.4" y2="4.6" />
                <line x1="4.6" y1="19.4" x2="6.9" y2="17.1" />
              </g>
            </svg>
          </span>
          <span className="toggle-icon toggle-moon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path
                d="M15.6 2.8a9.4 9.4 0 1 0 5.6 16.9 8 8 0 1 1-5.6-16.9Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="toggle-knob" aria-hidden="true" />
        </button>
        <button type="button" className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
