import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { apiUrl } from "@/url";
import Sidebar from "@/components/Sidebar";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart, TrendingUp, Users, FileText,
  AlertTriangle, Plus, Phone, MapPin, Award, Target,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Order {
  id: string;
  status: string;
  total: number | string;
  createdAt: string;
  retailerId: string;
  retailerName?: string;
}

interface Retailer {
  id: number;
  name: string;
  store_name: string;
  phone: string;
  address: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:   "#eab308",
  approved:  "#3b82f6",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

const StaffDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders]       = useState<Order[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate("/"); return; }
    if (user?.role !== "staff") { navigate("/dealer"); return; }
  }, [isAuthenticated, user, navigate]);

  // ── Fetch orders ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const token = localStorage.getItem("token") || localStorage.getItem("jwt");

    const fetchData = async () => {
      setLoading(true);
      try {
        // Orders by this executive
        const ordersRes = await fetch(
          `${apiUrl}/orders/byexecutive?executiveid=${user.id}`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
        if (ordersRes.ok) setOrders(await ordersRes.json());

        // Retailers assigned to this executive
        const retailersRes = await fetch(
          `${apiUrl}/staff/get_retailers_by_executive?executiveid=${user.id}`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
        if (retailersRes.ok) setRetailers(await retailersRes.json());
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysOrders = orders.filter((o) => {
      const d = new Date(o.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });

    const totalRevenue = orders.reduce((sum, o) => {
      return sum + (typeof o.total === "number" ? o.total : parseFloat(o.total) || 0);
    }, 0);

    const thisMonthOrders = orders.filter((o) => {
      const d = new Date(o.createdAt);
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    });

    const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => {
      return sum + (typeof o.total === "number" ? o.total : parseFloat(o.total) || 0);
    }, 0);

    const pendingCount   = orders.filter((o) => o.status === "pending").length;
    const deliveredCount = orders.filter((o) => o.status === "delivered").length;

    return {
      totalOrders:      orders.length,
      todaysOrders:     todaysOrders.length,
      totalRevenue,
      thisMonthRevenue,
      thisMonthOrders:  thisMonthOrders.length,
      pendingOrders:    pendingCount,
      deliveredOrders:  deliveredCount,
      totalRetailers:   retailers.length,
    };
  }, [orders, retailers]);

  // ── Orders over last 7 days ───────────────────────────────────────────────
  const ordersOverTime = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      days.push(date);
    }
    return days.map((date) => {
      const dayOrders = orders.filter((o) => {
        const d = new Date(o.createdAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === date.getTime();
      });
      return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        orders:  dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => {
          return sum + (typeof o.total === "number" ? o.total : parseFloat(o.total) || 0);
        }, 0) / 1000,
      };
    });
  }, [orders]);

  // ── Orders by status bar chart ────────────────────────────────────────────
  const ordersByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      pending: 0, approved: 0, delivered: 0, cancelled: 0,
    };
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) counts[o.status]++;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name:  status.charAt(0).toUpperCase() + status.slice(1),
      count,
      fill:  STATUS_COLORS[status],
    }));
  }, [orders]);

  // ── Top retailers by orders placed ───────────────────────────────────────
  const topRetailers = useMemo(() => {
    const map: Record<string, { name: string; orders: number; revenue: number }> = {};
    orders.forEach((o) => {
      const id = String(o.retailerId);
      if (!map[id]) {
        const retailer = retailers.find((r) => String(r.id) === id);
        map[id] = { name: retailer?.store_name || o.retailerName || `Customer ${id}`, orders: 0, revenue: 0 };
      }
      map[id].orders++;
      map[id].revenue += typeof o.total === "number" ? o.total : parseFloat(o.total) || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders, retailers]);

  // ── Recent orders ─────────────────────────────────────────────────────────
  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [orders]);

  const formatCurrency = (value: number) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000)   return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toLocaleString("en-IN")}`;
  };

  const todayDate = new Date().toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  const avatarColors = [
    "bg-blue-100 text-blue-700", "bg-green-100 text-green-700",
    "bg-purple-100 text-purple-700", "bg-orange-100 text-orange-700",
    "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700",
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="w-64 fixed top-0 left-0 h-full z-10">
        <Sidebar />
      </div>

      <div className="flex-1 ml-64 flex flex-col">
        <Navbar />

        <div className="flex-1 overflow-y-auto pt-16">
          <div className="container mx-auto px-4 py-6">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 text-sm mt-1">Your sales performance and activity</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate("/staff/sales_report")}
                  className="gap-2"
                >
                  <FileText size={15} /> Sales Report
                </Button>
                <Button
                  onClick={() => navigate("/staff")}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Plus size={15} /> Create Order
                </Button>
              </div>
            </div>

            {/* ── Top Stats Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.totalOrders}</div>
                  <p className="text-xs text-gray-500 mt-1">All time</p>
                </CardContent>
              </Card>

              <Card className={`border-l-4 ${stats.pendingOrders > 0 ? "border-l-yellow-500 border-2 border-yellow-200" : "border-l-yellow-500"}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Pending Orders</CardTitle>
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.pendingOrders}</div>
                  <p className="text-xs text-yellow-600 mt-1">Requires attention</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</div>
                  <p className="text-xs text-gray-500 mt-1">All time</p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Today's Orders</CardTitle>
                  <FileText className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{stats.todaysOrders}</div>
                  <p className="text-xs text-gray-500 mt-1">{todayDate}</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Secondary Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">This Month</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.thisMonthOrders}</div>
                    <p className="text-xs text-gray-500">Orders placed</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-100" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Monthly Revenue</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.thisMonthRevenue)}</div>
                    <p className="text-xs text-gray-500">This month</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-100" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">My Customers</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{stats.totalRetailers}</div>
                    <p className="text-xs text-gray-500">Assigned to you</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-100" />
                </CardContent>
              </Card>
            </div>

            {/* ── Charts Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Orders over time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Orders (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ordersOverTime}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }} />
                        <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue over time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Revenue (₹ in thousands)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ordersOverTime}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
                          formatter={(value: number) => [`₹${value.toFixed(1)}K`, "Revenue"]}
                        />
                        <Bar dataKey="revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Orders by Status + Top Retailers ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Orders by status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Orders by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ordersByStatus} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} stroke="#9ca3af" width={70} />
                        <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {ordersByStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Top customers by revenue */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Award size={18} className="text-yellow-500" /> Top Customers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topRetailers.length > 0 ? (
                    <div className="space-y-3">
                      {topRetailers.map((r, index) => (
                        <div key={index} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColors[index % avatarColors.length]}`}>
                              {index + 1}
                            </div>
                            <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <Badge variant="secondary" className="text-xs">{r.orders} orders</Badge>
                            <span className="text-sm font-semibold text-green-600">{formatCurrency(r.revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                      No order data yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Bottom Row: Recent Orders + My Customers ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Orders */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-semibold">Recent Orders</CardTitle>
                  <Link to="/staff/sales_report">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs">
                      View All
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {recentOrders.length > 0 ? (
                    <div className="space-y-3">
                      {recentOrders.map((order) => {
                        const total = typeof order.total === "number" ? order.total : parseFloat(order.total) || 0;
                        const retailer = retailers.find((r) => String(r.id) === String(order.retailerId));
                        return (
                          <div key={order.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {retailer?.store_name || order.retailerName || `Order #${String(order.id).slice(-6)}`}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge
                                className="text-xs"
                                style={{
                                  backgroundColor: `${STATUS_COLORS[order.status]}20`,
                                  color: STATUS_COLORS[order.status],
                                  border: `1px solid ${STATUS_COLORS[order.status]}40`,
                                }}
                              >
                                {order.status}
                              </Badge>
                              <span className="text-sm font-semibold text-gray-900">{formatCurrency(total)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                      No orders yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* My Customers */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-semibold">My Customers</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 text-xs"
                    onClick={() => navigate("/staff")}
                  >
                    Create Order
                  </Button>
                </CardHeader>
                <CardContent>
                  {retailers.length > 0 ? (
                    <div className="space-y-3">
                      {retailers.slice(0, 5).map((r, index) => (
                        <div key={r.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarColors[index % avatarColors.length]}`}>
                            {r.store_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.store_name}</p>
                            <p className="text-xs text-gray-400 truncate">{r.name}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <a
                              href={`tel:${r.phone}`}
                              className="h-7 w-7 flex items-center justify-center rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                            >
                              <Phone size={12} />
                            </a>
                            <a
                              href={`https://www.google.com/maps?q=${encodeURIComponent(r.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 w-7 flex items-center justify-center rounded-md bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                            >
                              <MapPin size={12} />
                            </a>
                          </div>
                        </div>
                      ))}
                      {retailers.length > 5 && (
                        <p className="text-xs text-center text-gray-400 pt-1">
                          +{retailers.length - 5} more customers
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                      No customers assigned yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
