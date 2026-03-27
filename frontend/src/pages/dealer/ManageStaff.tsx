import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import { useAuth } from "@/context/AuthContext";
import { Staff, Order } from "@/types";
import { toast } from "sonner";
import {
  Pencil, Trash2, Plus, UserCheck, TrendingUp, ShoppingCart, Award, Activity,
  User, Mail, Phone, Lock, MapPin, KeyRound, Briefcase,
} from "lucide-react";
import { apiUrl } from "@/url";
import * as XLSX from "xlsx";
import Sidebar from "@/components/Sidebar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Download, ArrowUpDown, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface StaffFormData {
  username: string;
  name: string;
  contact_person: string;
  sub_role: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  confirmPassword: string;
  dealer_id: string;
  role: string;
}

const emptyFormData: StaffFormData = {
  username: "", name: "", contact_person: "", sub_role: "",
  email: "", phone: "", address: "", password: "", confirmPassword: "",
  dealer_id: "", role: "",
};

interface StaffPerformance {
  staffId: string;
  ordersCount: number;
  totalRevenue: number;
  lastActivity: string | null;
}

const roleLabels: Record<string, string> = {
  executive: "Sales Executive",
};

const DealerStaff = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPerformanceDialogOpen, setIsPerformanceDialogOpen] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState<StaffFormData>(emptyFormData);
  const [isEditing, setIsEditing] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [entriesPerPage, setEntriesPerPage] = useState("10");
  const [sortOrder, setSortStaff] = useState<"asc" | "desc">("desc");
  const [sortBy, setSortBy] = useState<"name" | "revenue" | "orders">("name");

  useEffect(() => {
    if (!isAuthenticated) { navigate("/"); }
    else if (user?.role !== "dealer") { navigate("/retailer/dashboard"); }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const response = await fetch(`${apiUrl}/staff?dealerid=${user?.id}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error("Failed to fetch staff");
        const data = await response.json();
        setStaff(data);
        setFilteredStaff(data);
      } catch (error) { console.error("Failed to fetch staff:", error); }
    };
    if (user?.id) fetchStaff();
  }, [user?.id]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem("jwt") || localStorage.getItem("token");
        if (!token) return;
        const response = await fetch(`${apiUrl}/orders/fordealer?dealerId=${user?.id}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error("Failed to fetch orders");
        const data = await response.json();
        setOrders(data);
      } catch (error) { console.error("Failed to fetch orders:", error); }
    };
    if (user?.id) fetchOrders();
  }, [user?.id]);

  const staffPerformance = useMemo(() => {
    const performanceMap: Record<string, StaffPerformance> = {};
    orders.forEach((order) => {
      const staffId = String(order.order_by_id);
      if (order.order_by === "staff") {
        if (!performanceMap[staffId]) {
          performanceMap[staffId] = { staffId, ordersCount: 0, totalRevenue: 0, lastActivity: null };
        }
        performanceMap[staffId].ordersCount += 1;
        const orderTotal = typeof order.total === "number" ? order.total : parseFloat(order.total) || 0;
        performanceMap[staffId].totalRevenue += orderTotal;
        const orderDate = new Date(order.createdAt);
        if (!performanceMap[staffId].lastActivity || orderDate > new Date(performanceMap[staffId].lastActivity!)) {
          performanceMap[staffId].lastActivity = order.createdAt;
        }
      }
    });
    return performanceMap;
  }, [orders]);

  const overallStats = useMemo(() => {
    const totalStaff = staff.length;
    const salesExecutives = staff.filter((s) => s.sub_role === "executive" || s.sub_role === "sales_executive").length;
    let totalOrdersByStaff = 0, totalRevenueByStaff = 0;
    Object.values(staffPerformance).forEach((perf) => {
      totalOrdersByStaff += perf.ordersCount;
      totalRevenueByStaff += perf.totalRevenue;
    });
    const topPerformer = Object.values(staffPerformance).sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
    return { totalStaff, salesExecutives, totalOrdersByStaff, totalRevenueByStaff, topPerformerId: topPerformer?.staffId };
  }, [staff, staffPerformance]);

  const performanceChartData = useMemo(() => {
    return staff
      .filter((s) => s.sub_role === "executive" || s.sub_role === "sales_executive")
      .map((s) => {
        const perf = staffPerformance[String(s.id)] || { ordersCount: 0, totalRevenue: 0 };
        return { name: s.name?.split(" ")[0] || s.username, orders: perf.ordersCount, revenue: perf.totalRevenue / 1000 };
      })
      .slice(0, 10);
  }, [staff, staffPerformance]);

  const handleStaffSearch = (query: string) => {
    if (!query.trim()) { setFilteredStaff(staff); return; }
    const lowerQuery = query.toLowerCase();
    setFilteredStaff(staff.filter((s) =>
      s.username?.toLowerCase().includes(lowerQuery) ||
      s.name?.toLowerCase().includes(lowerQuery) ||
      s.email?.toLowerCase().includes(lowerQuery) ||
      s.phone?.toLowerCase().includes(lowerQuery) ||
      s.sub_role?.toLowerCase().includes(lowerQuery)
    ));
    setPage(1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddStaff = () => { setIsEditing(false); setFormData(emptyFormData); setIsDialogOpen(true); };

  const handleEditStaff = (staffItem: Staff) => {
    setIsEditing(true);
    setCurrentStaff(staffItem);
    setFormData({
      username: staffItem.username, name: staffItem.name, contact_person: staffItem.contact_person,
      sub_role: staffItem.sub_role, email: staffItem.email, phone: staffItem.phone,
      address: staffItem.address, password: "", confirmPassword: "",
      dealer_id: user?.id || "", role: staffItem.role || "",
    });
    setIsDialogOpen(true);
  };

  const handleViewPerformance = (staffItem: Staff) => { setCurrentStaff(staffItem); setIsPerformanceDialogOpen(true); };
  const handleDeleteStaff = (staffItem: Staff) => { setCurrentStaff(staffItem); setIsDeleteDialogOpen(true); };

  const confirmDeleteStaff = async () => {
    if (!currentStaff) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) { toast.error("Unauthorized: Token not found"); return; }
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const deleteResponse = await fetch(`${apiUrl}/staff/${currentStaff.id}`, { method: "DELETE", headers });
      if (!deleteResponse.ok) throw new Error("Failed to delete staff");
      toast.success("Staff deleted successfully");
      const listResponse = await fetch(`${apiUrl}/staff?dealerid=${user?.id}`, { headers });
      if (!listResponse.ok) throw new Error("Failed to fetch updated staff list");
      const updatedList = await listResponse.json();
      setStaff(updatedList);
      setFilteredStaff(updatedList);
    } catch (error) {
      console.error("Failed to delete staff:", error);
      toast.error("Failed to delete staff");
    } finally { setIsDeleteDialogOpen(false); }
  };

  const validateForm = (): boolean => {
    const { username, name, email, phone } = formData;
    if (!username || !name || !email || !phone) { toast.error("Please fill all required fields"); return false; }
    const existingStaff = staff.find((r) => r.username?.toLowerCase() === username.toLowerCase() && (!isEditing || r.id !== currentStaff?.id));
    if (existingStaff) { toast.error("Username already exists"); return false; }
    return true;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) { toast.error("Unauthorized: Token not found"); return; }
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const payload = { ...formData };
      payload.dealer_id = user?.id || "";
      payload.role = "staff";
      if (isEditing && !payload.password) { delete (payload as any).password; delete (payload as any).confirmPassword; }
      let res;
      if (isEditing && currentStaff) {
        res = await fetch(`${apiUrl}/staff/${currentStaff.id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Failed to update staff");
        toast.success("Staff updated successfully");
      } else {
        res = await fetch(`${apiUrl}/staff`, { method: "POST", headers, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Failed to create staff");
        toast.success("Staff added successfully");
      }
      const listResponse = await fetch(`${apiUrl}/staff?dealerid=${user?.id}`, { headers });
      if (!listResponse.ok) throw new Error("Failed to fetch updated staff list");
      const updatedList = await listResponse.json();
      setStaff(updatedList);
      setFilteredStaff(updatedList);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving staff:", error);
      toast.error("Failed to save staff");
    }
  };

  const staffOrders = useMemo(() => {
    if (!currentStaff) return [];
    return orders
      .filter((o) => o.order_by === "staff" && String(o.order_by_id) === String(currentStaff.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentStaff, orders]);

  const sortedStaff = useMemo(() => {
    return [...filteredStaff].sort((a, b) => {
      const perfA = staffPerformance[String(a.id)] || { ordersCount: 0, totalRevenue: 0 };
      const perfB = staffPerformance[String(b.id)] || { ordersCount: 0, totalRevenue: 0 };
      let comparison = 0;
      switch (sortBy) {
        case "name": comparison = (a.name || "").localeCompare(b.name || ""); break;
        case "revenue": comparison = perfA.totalRevenue - perfB.totalRevenue; break;
        case "orders": comparison = perfA.ordersCount - perfB.ordersCount; break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredStaff, staffPerformance, sortBy, sortOrder]);

  const totalPages = Math.ceil(sortedStaff.length / limit);
  const paginatedStaff = sortedStaff.slice((page - 1) * limit, page * limit);

  const handleExport = (type: "xlsx" | "csv") => {
    const data = staff.map((staffItem) => {
      const perf = staffPerformance[String(staffItem.id)] || { ordersCount: 0, totalRevenue: 0, lastActivity: null };
      return {
        Username: staffItem.username, Name: staffItem.name,
        "Staff Role": staffItem.sub_role?.charAt(0).toUpperCase() + staffItem.sub_role?.slice(1),
        Email: staffItem.email, Phone: staffItem.phone, Address: staffItem.address,
        "Orders Created": perf.ordersCount, "Revenue Generated (₹)": perf.totalRevenue.toFixed(2),
        "Last Activity": perf.lastActivity ? new Date(perf.lastActivity).toLocaleDateString() : "-",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    XLSX.writeFile(wb, `staff.${type}`);
  };

  const formatCurrency = (value: number) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toLocaleString("en-IN")}`;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="w-64 fixed top-0 left-0 h-full z-10">
        <Sidebar />
      </div>
      <div className="flex-1 ml-64 flex flex-col">
        <Navbar />
        <div className="flex-1 overflow-y-auto pt-16">
          <div className="container mx-auto px-4 py-6">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Staff</h1>
                <p className="text-gray-600 mt-1">Add, edit, or delete staff members</p>
              </div>
              <Button onClick={handleAddStaff} className="bg-royal hover:bg-royal-dark gap-2">
                <Plus size={16} /> Add Staff
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2"><UserCheck size={16} /> Total Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{overallStats.totalStaff}</div>
                  <p className="text-xs text-gray-500">Team members</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2"><Award size={16} /> Sales Executives</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{overallStats.salesExecutives}</div>
                  <p className="text-xs text-gray-500">Active executives</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2"><ShoppingCart size={16} /> Orders by Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{overallStats.totalOrdersByStaff}</div>
                  <p className="text-xs text-gray-500">Total created</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2"><TrendingUp size={16} /> Revenue by Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{formatCurrency(overallStats.totalRevenueByStaff)}</div>
                  <p className="text-xs text-gray-500">Generated</p>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="mb-4">
              <SearchBar onSearch={handleStaffSearch} />
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show</span>
                    <Select value={entriesPerPage} onValueChange={(value) => { setEntriesPerPage(value); setPage(1); if (value === "all") setLimit(sortedStaff.length); else setLimit(Number(value)); }}>
                      <SelectTrigger className="w-[100px]"><SelectValue placeholder="Select entries" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-gray-600">entries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <SelectTrigger className="w-[130px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="orders">Orders</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setSortStaff(sortOrder === "asc" ? "desc" : "asc")}>
                      <ArrowUpDown className="w-4 h-4 mr-1" />{sortOrder === "asc" ? "↑" : "↓"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("csv")}><Download className="w-4 h-4 mr-1" /> CSV</Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}><Download className="w-4 h-4 mr-1" /> Excel</Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStaff.length > 0 ? (
                      paginatedStaff.map((staffItem) => {
                        const perf = staffPerformance[String(staffItem.id)] || { ordersCount: 0, totalRevenue: 0, lastActivity: null };
                        const isTopPerformer = String(staffItem.id) === overallStats.topPerformerId;
                        return (
                          <TableRow key={staffItem.id} className={isTopPerformer ? "bg-yellow-50" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <p className="font-medium">{staffItem.name}</p>
                                  <p className="text-xs text-gray-500">{staffItem.username}</p>
                                </div>
                                {isTopPerformer && perf.totalRevenue > 0 && <Badge className="bg-yellow-500">Top</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{staffItem.sub_role?.charAt(0).toUpperCase() + staffItem.sub_role?.slice(1) || "Staff"}</Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{staffItem.phone}</p>
                                <p className="text-xs text-gray-500">{staffItem.email}</p>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="secondary">{perf.ordersCount}</Badge></TableCell>
                            <TableCell><span className="font-medium text-green-600">{formatCurrency(perf.totalRevenue)}</span></TableCell>
                            <TableCell>{perf.lastActivity ? new Date(perf.lastActivity).toLocaleDateString() : "-"}</TableCell>
                            <TableCell>
                              <div className="flex space-x-1">
                                <Button variant="outline" size="sm" onClick={() => handleViewPerformance(staffItem)} title="View Performance"><Eye size={16} /></Button>
                                <Button variant="outline" size="sm" onClick={() => handleEditStaff(staffItem)} title="Edit"><Pencil size={16} /></Button>
                                <Button variant="outline" size="sm" onClick={() => handleDeleteStaff(staffItem)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={16} /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <UserCheck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500">No staff found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="p-4 border-t flex justify-between items-center text-sm text-gray-600 flex-wrap gap-2">
                  <div>Showing {sortedStaff.length > 0 ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, sortedStaff.length)} of {sortedStaff.length} entries</div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /> Previous</Button>
                    <span className="font-semibold">{page} / {totalPages || 1}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Chart */}
            {performanceChartData.length > 0 && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Activity size={18} /> Staff Performance Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                          formatter={(value: number, name: string) => [
                            name === "revenue" ? `₹${value.toFixed(1)}K` : value,
                            name === "revenue" ? "Revenue" : "Orders",
                          ]}
                        />
                        <Bar dataKey="orders" fill="#3b82f6" name="Orders" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="revenue" fill="#22c55e" name="Revenue (K)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ✅ ENHANCED Add/Edit Staff Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-purple-100 flex items-center justify-center">
                      <UserCheck className="h-4 w-4 text-purple-600" />
                    </div>
                    {isEditing ? "Edit Staff" : "Add New Staff"}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleFormSubmit}>
                  <div className="grid gap-4 py-4">

                    {/* Row 1: Username + Name */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="username" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-gray-400" /> Username <span className="text-red-500">*</span>
                        </Label>
                        <Input id="username" name="username" value={formData.username} onChange={handleInputChange} placeholder="e.g. john_sales" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-gray-400" /> Full Name <span className="text-red-500">*</span>
                        </Label>
                        <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. John Doe" required />
                      </div>
                    </div>

                    {/* Row 2: Staff Role (full width using shadcn Select) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="sub_role" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 text-gray-400" /> Staff Role <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={formData.sub_role}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, sub_role: value }))}
                        required
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Row 3: Email + Phone */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-gray-400" /> Email <span className="text-red-500">*</span>
                        </Label>
                        <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="e.g. john@company.com" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-gray-400" /> Phone <span className="text-red-500">*</span>
                        </Label>
                        <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="e.g. 9876543210" required />
                      </div>
                    </div>

                    {/* Row 4: Address (full width) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" /> Address
                      </Label>
                      <Input id="address" name="address" value={formData.address} onChange={handleInputChange} placeholder="e.g. 12 Main Street, Mumbai" />
                    </div>

                    {/* Row 5: Password + Confirm Password */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <Lock className="h-3.5 w-3.5 text-gray-400" /> Password{!isEditing && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          id="password" name="password" type="password"
                          value={formData.password} onChange={handleInputChange}
                          required={!isEditing}
                          placeholder={isEditing ? "Leave blank to keep" : "Enter password"}
                        />
                      </div>
                      {!isEditing && (
                        <div className="space-y-1.5">
                          <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <KeyRound className="h-3.5 w-3.5 text-gray-400" /> Confirm Password <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="confirmPassword" name="confirmPassword" type="password"
                            value={formData.confirmPassword} onChange={handleInputChange}
                            required placeholder="Re-enter password"
                          />
                        </div>
                      )}
                    </div>

                  </div>

                  <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-royal hover:bg-royal-dark text-white">
                      {isEditing ? "Update Staff" : "Add Staff"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Performance Dialog — unchanged */}
            <Dialog open={isPerformanceDialogOpen} onOpenChange={setIsPerformanceDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Activity size={20} /> Performance - {currentStaff?.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-gray-500">Total Orders Created</p>
                        <p className="text-2xl font-bold text-blue-600">{staffPerformance[String(currentStaff?.id)]?.ordersCount || 0}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-gray-500">Revenue Generated</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(staffPerformance[String(currentStaff?.id)]?.totalRevenue || 0)}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <h3 className="font-semibold mb-3">Recent Activity</h3>
                  {staffOrders.length > 0 ? (
                    <div className="space-y-3">
                      {staffOrders.slice(0, 10).map((order) => (
                        <Card key={order.id} className="p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">Order #{order.id.slice(-8)}</p>
                              <p className="text-sm text-gray-500">{order.retailerName || order.storeName}</p>
                              <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString()}</p>
                            </div>
                            <div className="text-right">
                              <Badge className={order.status === "delivered" ? "bg-green-500" : order.status === "pending" ? "bg-yellow-500" : order.status === "approved" ? "bg-blue-500" : "bg-purple-500"}>
                                {order.status}
                              </Badge>
                              <p className="font-semibold mt-1">₹{(typeof order.total === "number" ? order.total : parseFloat(order.total) || 0).toLocaleString("en-IN")}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No orders created by this staff member</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </div>
                    Delete Staff
                  </DialogTitle>
                </DialogHeader>
                <div className="py-3">
                  <p className="text-sm text-gray-700">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900">{currentStaff?.name}</span>?
                  </p>
                  <p className="text-xs text-gray-400 mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    ⚠️ This action cannot be undone.
                  </p>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                  <Button onClick={confirmDeleteStaff} className="bg-red-500 hover:bg-red-600 text-white">Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </div>
      </div>
    </div>
  );
};

export default DealerStaff;
