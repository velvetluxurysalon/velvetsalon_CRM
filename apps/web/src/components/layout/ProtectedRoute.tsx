import { Navigate, Outlet } from "react-router-dom";
import { useAuth, type Role } from "../../context/AuthContext";

interface ProtectedRouteProps {
  /** Which roles are allowed. Empty/undefined = any authenticated user. */
  allowedRoles?: Role[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#faf8f4",
        fontFamily: "'Jost', sans-serif",
        fontSize: 13,
        letterSpacing: "0.12em",
        color: "#b8860b",
        textTransform: "uppercase",
      }}>
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}