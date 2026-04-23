import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.jsx";
import { InternalHelpChatbot } from "../components/InternalHelpChatbot.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import "./AppShell.css";

const LINKS = [
  { to: "/faculty/dashboard", label: "Dashboard" },
  { to: "/faculty/upload", label: "Upload" },
  { to: "/faculty/analytics", label: "Analytics" },
  { to: "/faculty/grade-bands", label: "Grade bands" },
  { to: "/faculty/profile", label: "Profile" },
];

export function FacultyLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="app-shell">
      <Sidebar title="Faculty" links={LINKS} onLogout={handleLogout} />
      <main className="app-main">
        <Outlet />
      </main>
      <InternalHelpChatbot role="faculty" />
    </div>
  );
}
