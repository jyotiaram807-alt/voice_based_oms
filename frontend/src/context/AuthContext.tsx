import { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User } from "../types";
import { apiUrl } from "@/url";

interface AuthContextType {
  loading: boolean;
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();
  const location = useLocation();

  const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day

  // ---------------- LOGIN ----------------
 // ---------------- LOGIN ----------------
const login = async (username: string, password: string): Promise<boolean> => {
  setLoading(true);
  try {
    const res = await fetch(`${apiUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) throw new Error("Login failed");

    const result = await res.json();
    const { token, user } = result;

    if (!token || !user) throw new Error("Missing token or user data");

    localStorage.setItem("token",          token);
    localStorage.setItem("user",           JSON.stringify(user));
    localStorage.setItem("tokenTimestamp", Date.now().toString());
    setUser(user);

    // ── Notify CartContext to load this user's cart ──────────────────────
    window.dispatchEvent(
      new CustomEvent("userLogin", { detail: { userId: String(user.id) } })
    );

    redirectUser(user);
    return true;
  } catch (error) {
    console.error("Login failed:", error);
    return false;
  } finally {
    setLoading(false);
  }
};

// ---------------- LOGOUT ----------------
const logout = () => {
  const currentUserId = user?.id ? String(user.id) : null;

  setUser(null);
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("tokenTimestamp");
  localStorage.removeItem("selectedRetailer");

  // ── Notify CartContext to clear this user's cart ─────────────────────
  if (currentUserId) {
    window.dispatchEvent(
      new CustomEvent("userLogout", { detail: { userId: currentUserId } })
    );
  }

  navigate("/", { replace: true });
};

  // ---------------- REDIRECT USER ----------------
  const redirectUser = (user: User) => {
    const { role, sub_role } = user;
    if (role === "staff" && sub_role === "executive") navigate("/staff", { replace: true });
    else if (role === "dealer") navigate("/dealer", { replace: true });
    else if (role === "retailer") navigate("/retailer/dashboard", { replace: true });
    else navigate("/", { replace: true });
  };

  // ---------------- AUTO LOGIN / TOKEN VALIDATION ----------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    const tokenTimestamp = localStorage.getItem("tokenTimestamp");

    if (!token || !storedUser) {
      setLoading(false);
      return;
    }

    const localUser = JSON.parse(storedUser);

    const validateSession = async () => {
      try {
        // 1️⃣ Check token expiry
        if (!tokenTimestamp || Date.now() - parseInt(tokenTimestamp) > TOKEN_EXPIRY_MS) {
          logout();
          return;
        }

        // 2️⃣ Validate token with backend
        const res = await fetch(`${apiUrl}/validate-token`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) throw new Error("Token invalid or expired");

        setUser(localUser);

        // 3️⃣ Redirect if on wrong page
        const { role, sub_role } = localUser;
        if (role === "staff" && sub_role === "executive" && !location.pathname.startsWith("/staff"))
          navigate("/staff", { replace: true });
        else if (role === "dealer" && !location.pathname.startsWith("/dealer"))
          navigate("/dealer", { replace: true });
        else if (role === "retailer" && !location.pathname.startsWith("/retailer/dashboard"))
          navigate("/retailer/dashboard", { replace: true });
      } catch (error) {
        console.warn("Session invalid:", error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    validateSession();
  }, []);

  // ---------------- LOADING STATE ----------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-lg font-semibold text-gray-600">
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ---------------- useAuth Hook ----------------
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};