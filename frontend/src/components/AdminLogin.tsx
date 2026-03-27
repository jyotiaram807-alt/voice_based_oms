import { useState,useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
const AdminLogin = ({ switchToUser }: { switchToUser: () => void }) => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }
    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (!success) {
        toast.error("Invalid username or password");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
    useEffect(() => {
        if (isAuthenticated) {
          if (user?.role === "admin") {
            navigate("/admin");
          } else {
            navigate("/");
          }
        }
        else {
            navigate("/");
          }
      }, [isAuthenticated, user?.role, navigate]);
  };
  return (
    <Card className="w-full max-w-md mx-3 sm:mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl sm:text-2xl text-blue-500 font-bold text-center">Admin Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">Admin Username</label>
            <Input id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="input-royal" />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="input-royal"
            />
          </div>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-royal hover:bg-royal-dark">
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-end">
        <div className="text-xs sm:text-xs text-gray-500">
          <span 
            onClick={switchToUser}
            className="cursor-pointer text-gray-300 hover:underline">User Login
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};
export default AdminLogin;