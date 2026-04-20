import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./AppShell.css";

const LINKS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/review-marks", label: "Review marks" },
  { to: "/admin/analytics", label: "Analytics" },
  { to: "/admin/grade-bands", label: "Grade bands" },
  { to: "/admin/faculty-access", label: "Faculty access" },
];

export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell">
      <Sidebar title="Admin / HOD" links={LINKS} onLogout={handleLogout} />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
