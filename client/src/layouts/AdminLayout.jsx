import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.jsx";
import { InternalHelpChatbot } from "../components/InternalHelpChatbot.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./AppShell.css";

const LINKS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/analysis-of-students", label: "Grade Band" },
  { to: "/admin/analytics", label: "Analytics" },
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
      <InternalHelpChatbot role="admin" />
    </div>
  );
}
