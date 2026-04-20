import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string[]} [props.allowedRoles]
 */
export function ProtectedRoute({ children, allowedRoles }) {
  const { token, user } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (
    allowedRoles?.length &&
    user?.role &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}
