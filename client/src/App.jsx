import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { AdminLayout } from "./layouts/AdminLayout.jsx";
import { FacultyLayout } from "./layouts/FacultyLayout.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { AdminDashboard } from "./pages/admin/AdminDashboard.jsx";
import { AdminAnalyticsPage } from "./pages/admin/AdminAnalyticsPage.jsx";
import { AdminStudentAnalysisPage } from "./pages/admin/AdminStudentAnalysisPage.jsx";
import { FacultyAccessPage } from "./pages/admin/FacultyAccessPage.jsx";
import { FacultyDashboard } from "./pages/faculty/FacultyDashboard.jsx";
import { UploadPage } from "./pages/faculty/UploadPage.jsx";
import { AnalyticsPage } from "./pages/faculty/AnalyticsPage.jsx";
import { GradeBandsPage } from "./pages/faculty/GradeBandsPage.jsx";
import { ProfilePage } from "./pages/faculty/ProfilePage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="analysis-of-students" element={<AdminStudentAnalysisPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="faculty-access" element={<FacultyAccessPage />} />
      </Route>

      <Route
        path="/faculty"
        element={
          <ProtectedRoute allowedRoles={["faculty"]}>
            <FacultyLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<FacultyDashboard />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="grade-bands" element={<GradeBandsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
