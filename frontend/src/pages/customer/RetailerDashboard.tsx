import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Package,
  Clock,
  CheckCircle2,
  Truck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { fetchRetailerOrders } from "@/services/api";
import { Order } from "@/types";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-600 border-amber-200",
  approved: "bg-blue-100 text-blue-600 border-blue-200",
  dispatched: "bg-indigo-100 text-indigo-600 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-600 border-emerald-200",
};

const RetailerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchRetailerOrders(user.id)
      .then((data) => setOrders(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
  const inTransitOrders = orders.filter((o) => o.status === "dispatched").length;
  const recentOrders = orders.slice(0, 5);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 fixed left-0 top-0 h-full">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64 flex flex-col overflow-auto">
        <Navbar />

        <div className="px-8 py-6 pt-16">
          {/* Header */}
          <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Welcome back, {user?.name || "Retailer"}!
          </p>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">
            <Stat
              title="Total Orders"
              value={orders.length}
              icon={<ShoppingCart />}
            />
            <Stat
              title="Pending Orders"
              value={pendingOrders}
              icon={<Clock />}
            />
            <Stat
              title="Delivered"
              value={deliveredOrders}
              icon={<CheckCircle2 />}
            />
            <Stat
              title="In Transit"
              value={inTransitOrders}
              icon={<Truck />}
            />
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
            {/* Recent Orders */}
            <div className="xl:col-span-2 bg-white rounded-xl shadow border">
              <div className="flex justify-between items-center px-6 py-4 border-b">
                <h2 className="font-semibold text-lg">Recent Orders</h2>
                <button
                  onClick={() => navigate("/retailer/orders")}
                  className="text-blue-600 text-sm font-medium hover:underline"
                >
                  View all
                </button>
              </div>

              {loading ? (
                <div className="p-8 text-center">Loading...</div>
              ) : recentOrders.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No orders yet
                </div>
              ) : (
                <div>
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex justify-between items-center px-6 py-4 border-b last:border-0 hover:bg-slate-50"
                    >
                      <div className="flex gap-4 items-center">
                        <div className="bg-slate-100 p-3 rounded-lg">
                          <Truck size={18} />
                        </div>

                        <div>
                          <p className="font-medium">
                            Order #{order.id}
                          </p>
                          <p className="text-sm text-slate-500">
                            {order.items?.length || 0} items ·{" "}
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-semibold">
                          ₹{order.total?.toLocaleString("en-IN")}
                        </span>

                        <span
                          className={`text-xs px-3 py-1 rounded-full border ${
                            statusBadge[order.status]
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow border">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold text-lg">Quick Actions</h2>
              </div>

              <div className="p-6 space-y-4">
                <button
                  onClick={() => navigate("/retailer/products")}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
                >
                  <Package size={18} />
                  Browse Products
                </button>

                <button
                  onClick={() => navigate("/retailer/orders")}
                  className="w-full flex items-center justify-center gap-2 border py-3 rounded-lg font-medium hover:bg-slate-50"
                >
                  <ShoppingCart size={18} />
                  View All Orders
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetailerDashboard;





/* ---------- Small Stat Card Component ---------- */

const Stat = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) => (
  <div className="bg-white rounded-xl shadow border p-6 flex justify-between items-center">
    <div>
      <p className="text-slate-500 text-sm">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>

    <div className="bg-slate-100 p-3 rounded-lg text-slate-600">
      {icon}
    </div>
  </div>
);