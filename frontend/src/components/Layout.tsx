import React from "react";
import Navbar from "./Navbar";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";
import '../assets/css/style.css'; // ✅ Relative import works


interface LayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requiredRole?: "dealer" | "retailer";
}

const Layout: React.FC<LayoutProps> = ({
  children,
  requireAuth = false,
  requiredRole,
}) => {
  const { isAuthenticated, user } = useAuth();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (
    requireAuth &&
    isAuthenticated &&
    requiredRole &&
    user?.role !== requiredRole
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="responsive-bg" style={{ height: "100%", minHeight: "100vh", width: "100%" }}>
      {/* <Navbar /> */}
      <div
        style={{
          backgroundColor: "rgba(255, 255, 245, 0.75)",
          minHeight: "100vh",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Layout;