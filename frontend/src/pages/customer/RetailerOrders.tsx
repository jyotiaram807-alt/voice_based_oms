import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // 👈 Add this
import Navbar from "@/components/Navbar";
import OrdersList from "@/components/OrdersList";
import { useAuth } from "@/context/AuthContext";
import { Order,Retailer, Staff } from "@/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiUrl } from "@/url";
import Sidebar from "@/components/Sidebar";

const RetailerOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const { user, isAuthenticated } = useAuth(); // 👈 Destructure here
  const isMobile = useIsMobile();
  const navigate = useNavigate(); // 👈 Use navigate
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);

  // 🔐 Redirect if not authenticated or not a retailer
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
    } else if (user?.role !== "retailer") {
      navigate("/dealer"); // Or wherever you want to redirect
    }
  }, [isAuthenticated, user, navigate]);

  // ✅ GET orders that belong to this retailer
 useEffect(() => {
  if (!user?.id) return;

  const fetchOrders = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("No token found. Please log in again.");
          return;
        }

        const res = await fetch(`${apiUrl}/orders?retailerId=${user.id}`, {
          headers: {
            "Authorization": `Bearer ${token}`, // ✅ secure token-based access
            "Content-Type": "application/json",
          },
        });

        if (res.status === 401 || res.status === 403) {
          console.error("Unauthorized access. Token may be invalid or expired.");
          // Optional: logout user or redirect to login page
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch orders");

        const data: Order[] = await res.json();
        setOrders(data);
        setFilteredOrders(data);
      } catch (err) {
        console.error("Order fetch error:", err);
      }
    };

    fetchOrders();
  }, [user?.id]);


  const getFilteredOrders = () =>
    activeTab === "all"
      ? orders
      : orders.filter((o) => o.status === activeTab);

  return (
  <div className="flex h-screen overflow-hidden">
    {/* Sidebar */}
    <div className="w-64 fixed top-0 left-0 h-full">
      <Sidebar />
    </div>

    {/* Main Content Area */}
    <div className="flex-1 ml-64 flex flex-col">
      <Navbar />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pt-16">
        <div className="container mx-auto px-4 mt-4 mb-6">
          <p className="text-gray-600 text-lg mb-4">Track your order history and status</p>

          <div className="bg-white rounded-lg shadow">
            <div className="p-3 md:p-6">
              <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
                {isMobile ? (
                  <ScrollArea className="w-full pb-2">
                    <TabsList className="mb-4 flex w-max">
                      <TabsTrigger value="all">All Orders</TabsTrigger>
                      <TabsTrigger value="pending">Pending</TabsTrigger>
                      <TabsTrigger value="approved">Approved</TabsTrigger>
                      <TabsTrigger value="dispatched">Dispatched</TabsTrigger>
                      <TabsTrigger value="delivered">Delivered</TabsTrigger>
                    </TabsList>
                  </ScrollArea>
                ) : (
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All Orders</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved">Approved</TabsTrigger>
                    <TabsTrigger value="dispatched">Dispatched</TabsTrigger>
                    <TabsTrigger value="delivered">Delivered</TabsTrigger>
                  </TabsList>
                )}

                <TabsContent value={activeTab}>
                  <OrdersList
                    orders={filteredOrders}
                    highlightNew={activeTab === "pending" || activeTab === "all"}
                    retailers={retailers}
                    staff={filteredStaff}
                  />

                  {filteredOrders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No orders found matching your search.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)

};

export default RetailerOrders;