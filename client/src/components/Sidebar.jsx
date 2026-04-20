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
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark">ExamGrade</span>
        <span className="sidebar-brand-sub">{title}</span>
        <button type="button" className="sidebar-theme-toggle" onClick={toggleTheme}>
          {isDark ? "Light mode" : "Dark mode"}
        </button>
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
      <button type="button" className="sidebar-logout" onClick={onLogout}>
        Logout
      </button>
    </aside>
  );
}
