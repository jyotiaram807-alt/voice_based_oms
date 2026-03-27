import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "@/components/LoginForm";
import { useAuth } from "@/context/AuthContext";

const Index = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === "admin") {
        navigate("/admin");
      } else if (user?.role === "dealer") {
        navigate("/dealer");
      } else {
        navigate("/retailer/dashboard");
      }
    }
  }, [isAuthenticated, user?.role, navigate]);

  return (
    <div
      className="h-screen bg-[#f3f9fd] bg-no-repeat bg-center bg-cover md:bg-contain flex items-center justify-end overflow-hidden"
      style={{
        backgroundImage: "url('/images/login.jpeg')",
      }}
    >
      <div className="max-w-md w-full px-4 md:mr-8">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-royal mb-2">Seerweb OMS</h1>
          <p className="text-gray-600 mb-6 sm:mb-8">Phone Ordering Management System</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
  
};

export default Index;