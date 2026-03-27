import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface PrivateRouteProps {
  children: React.ReactElement;
  requiredRole?: "dealer" | "retailer" | "admin";
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to their appropriate dashboard if they hit a route they don't have access to
    if (user?.role === "admin") return <Navigate to="/admin" replace />;
    if (user?.role === "dealer") return <Navigate to="/dealer" replace />;
    if (user?.role === "retailer") return <Navigate to="/retailer/dashboard" replace />;
  }

  return children;
};

export default PrivateRoute;
