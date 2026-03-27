import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Order, OrderStatus, Retailer, Staff } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ArrowUpDown,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import * as XLSX from "xlsx";
import { Input } from "@/components/ui/input";

interface OrdersListProps {
  orders: Order[];
  isAdmin?: boolean;
  onStatusChange?: (orderId: string, status: OrderStatus) => void;
  highlightNew?: boolean;
  retailers:Retailer[];
  staff:Staff[];
}

const OrdersList: React.FC<OrdersListProps> = ({
  orders,
  isAdmin = false,
  onStatusChange,
  highlightNew = false,
  retailers,
  staff
}) => {
  const { user } = useAuth();

  const [localOrders, setLocalOrders] = useState<Order[]>(orders);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(orders);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [entriesPerPage, setEntriesPerPage] = useState("10");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportRetailerId, setReportRetailerId] = useState<string>("all");
  const [reportStaffId, setReportStaffId] = useState<string>("all");
  const [activeTabForOrder, setActiveTabForOrder] = useState<string>("all");

  // Update local orders when prop changes
  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  // Filtering logic
  useEffect(() => {
    let filtered = [...localOrders];

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() - today.getDay() + 7);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);

    const endOfLastWeek = new Date(endOfWeek);
    endOfLastWeek.setDate(endOfWeek.getDate() - 7);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    filtered = filtered.filter((order: Order) => {
      const orderDate = new Date(order.createdAt);

      switch (dateFilter) {
        case "today":
          return orderDate.toDateString() === today.toDateString();
        case "yesterday":
          return orderDate.toDateString() === yesterday.toDateString();
        case "this_week":
          return orderDate >= startOfWeek && orderDate <= endOfWeek;
        case "last_week":
          return orderDate >= startOfLastWeek && orderDate <= endOfLastWeek;
        case "this_month":
          return orderDate >= startOfMonth && orderDate <= endOfMonth;
        case "last_month":
          return orderDate >= startOfLastMonth && orderDate <= endOfLastMonth;
        case "period":
          if (!fromDate || !toDate) return true;
          const from = new Date(fromDate);
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999);
          return orderDate >= from && orderDate <= to;
        default:
          return true;
      }
    });

    if (reportRetailerId !== "all") {
      filtered = filtered.filter((o) => String(o.retailerId) === reportRetailerId);
    }

    if (reportStaffId !== "all") {
      filtered = filtered.filter(
        (o) => String(o.order_by_id) === reportStaffId
      );
    }


    if (activeTabForOrder !== "all") {
      filtered = filtered.filter((o) => o.status === activeTabForOrder);
    }

    setFilteredOrders(filtered);
    setPage(1);
  }, [localOrders, dateFilter, fromDate, toDate, reportRetailerId, reportStaffId, activeTabForOrder]);


  // Sorting + Pagination
  const sortedFiltered = useMemo(() => {
    const sorted = [...filteredOrders].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    if (entriesPerPage === "all") return sorted;
    const start = (page - 1) * limit;
    return sorted.slice(start, start + limit);
  }, [filteredOrders, sortOrder, page, limit, entriesPerPage]);

  const totalPages =
    entriesPerPage === "all" ? 1 : Math.ceil(filteredOrders.length / limit);

  // Helpers
  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "approved":
        return "bg-blue-100 text-blue-800";
      case "dispatched":
        return "bg-purple-100 text-purple-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const isRecentOrder = (order: Order) => {
    const orderTime = new Date(order.createdAt).getTime();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return orderTime > oneHourAgo;
  };

  const handleExport = (type: "xlsx" | "csv") => {
    const data = filteredOrders.map((o) => ({
      "Order ID": o.id,
      Retailer: o.retailerName,
      "Store Name": o.storeName,
      Total: o.total,
      Status: o.status,
      Date: new Date(o.createdAt).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `orders.${type}`);
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setLocalOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
    if (onStatusChange) onStatusChange(orderId, newStatus);
  };

  return (
    <div>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white mb-8">
        {/* Date Filter */}
        <div>
          <label className="text-gray-700 font-semibold mb-1">Date Filter</label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select Date Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aa">View All</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="period">Custom Period</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {dateFilter === "period" && (
          <div>
            <label className="text-gray-700 font-semibold mb-1">From</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <label className="text-gray-700 font-semibold mb-1 mt-2">To</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        )}

        {/* Retailer Filter */}
        {user?.role !== "retailer" && (
          <div>
            <label className="text-gray-700 font-semibold mb-1">Customers</label>
            <Select
              value={reportRetailerId}
              onValueChange={(value) => setReportRetailerId(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Retailer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {retailers.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.store_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {user?.role == "dealer" && (
          <div>
              <label className="text-gray-700 font-semibold mb-1">Sales Executive</label>
              <Select
                value={reportStaffId}
                onValueChange={(value) => setReportStaffId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Retailer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staff.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </div>
        )}

      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 border">
        {/* Controls */}
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show</span>
            <Select
              value={entriesPerPage}
              onValueChange={(value) => {
                setEntriesPerPage(value);
                if (value === "all") setLimit(filteredOrders.length);
                else setLimit(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Entries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600">entries</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSortOrder(sortOrder === "asc" ? "desc" : "asc")
              }
            >
              <ArrowUpDown className="w-4 h-4 mr-1" />
              Sort {sortOrder === "asc" ? "↑" : "↓"}
            </Button>

            {user?.role === "dealer" && (
              <>
                <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}>
                  <Download className="w-4 h-4 mr-1" /> Excel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                {isAdmin && <TableHead>Retailer</TableHead>}
                <TableHead>Store Name</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Date</TableHead>
                {isAdmin && <TableHead>Order By</TableHead>}
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFiltered.length > 0 ? (
                sortedFiltered.map((order) => {
                  const isNew =
                    highlightNew &&
                    order.status === "pending" &&
                    isRecentOrder(order);

                  return (
                    <TableRow key={order.id} className={isNew ? "bg-yellow-50" : ""}>
                      <TableCell className="flex items-center gap-1">
                        {String(order.id).slice(0, 8)}
                        {isNew && <AlertTriangle size={16} className="text-yellow-600" />}
                      </TableCell>

                      {isAdmin && <TableCell>{order.retailerName}</TableCell>}
                      <TableCell>{order.storeName}</TableCell>
                      <TableCell>
                        ₹{Number(order.total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell>
                        {isAdmin ? (
                          <Select
                            value={order.status}
                            onValueChange={(value: OrderStatus) =>
                              handleStatusChange(order.id, value)
                            }
                          >
                            <SelectTrigger className={`w-[140px] ${getStatusColor(order.status)}`}>
                              <SelectValue placeholder={order.status} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="dispatched">Dispatched</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusColor(
                              order.status
                            )}`}
                          >
                            {order.status}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.notes}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{new Date(order.createdAt).toLocaleDateString("en-IN")}</span>
                          
                          <span className="text-sm text-gray-500">
                            {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </div>
                      </TableCell>
                      {isAdmin && <TableCell>
                        {order.order_by}
                      </TableCell>}
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedOrder(order)}
                            >
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Order Details</DialogTitle>
                            </DialogHeader>
                            {selectedOrder && selectedOrder.id === order.id && (
                              <div className="mt-4">
                                <p className="text-sm text-muted-foreground mb-2">
                                  Order #{String(selectedOrder.id).slice(0, 8)} -{" "}
                                  {new Date(selectedOrder.createdAt).toLocaleString()}
                                </p>
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-medium">Items:</h4>
                                    <ul className="mt-2 space-y-2">
                                      {selectedOrder.items.map((item, i) => (
                                        <li key={i} className="flex justify-between text-sm">
                                          <span>
                                            {item.product.name} x {item.quantity}
                                          </span>
                                          <span>
                                            {(item.product.price * item.quantity).toFixed(2)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div className="flex justify-between font-medium">
                                    <span>Total:</span>
                                    <span>{Number(selectedOrder.total).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 7 : 6}
                    className="text-center text-gray-500 py-4"
                  >
                    No orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-3 text-sm text-gray-600 flex-wrap gap-2">
          <div>
            Showing {(page - 1) * limit + 1} to{" "}
            {Math.min(page * limit, filteredOrders.length)} of{" "}
            {filteredOrders.length} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <span className="font-semibold">
              {page} / {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersList;