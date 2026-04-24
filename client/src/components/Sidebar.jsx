import { NavLink } from "react-router-dom";
import "./Sidebar.css";

/**
 * @param {object} props
 * @param {string} props.title
 * @param {{ to: string, label: string }[]} props.links
 * @param {() => void} props.onLogout
 */
export function Sidebar({ title, links, onLogout }) {
  return (
    <header className="sidebar">
      <div className="sidebar-brand">
        <img
          className="sidebar-brand-logo"
          src="/fr-crce-logo.png"
          width={1024}
          height={394}
          alt="Fr. Conceicao Rodrigues College of Engineering (Fr. CRCE)"
        />
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-app">GradeX</span>
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
        <button type="button" className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
