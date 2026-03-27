import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
import { useAuth } from "@/context/AuthContext";
import { Product, Order, OrderStatus, Retailer, Staff } from "@/types";
import { apiUrl } from "@/url";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Minus, Trash2, Phone, MapPin, Search,
  User, Package, ShoppingCart, Store,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import Sidebar from "@/components/Sidebar";

const SalesExecutiveDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const { cart, clearCart, updateQuantity, removeFromCart } = useCart();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [filteredRetailers, setFilteredRetailers] = useState<Retailer[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<string>("retailers");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [isOrderConfirmOpen, setIsOrderConfirmOpen] = useState(false);
  const [retailerSearch, setRetailerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const handleQuantityChange = (productId: string, change: number, currentQty: number) => {
    const newQty = currentQty + change;
    if (newQty >= 1) updateQuantity(productId, newQty);
  };

  useEffect(() => {
    if (!isAuthenticated) { navigate("/"); return; }
    if (user?.role !== "staff") { navigate("/dealer"); return; }
  }, [isAuthenticated, user, navigate]);

  // ✅ Fixed: executiveid (not executive_id)
  useEffect(() => {
    if (!user?.id) return;
    const fetchRetailers = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const response = await fetch(
          `${apiUrl}/staff/get_retailers_by_executive?executiveid=${user.id}`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
        if (!response.ok) throw new Error("Failed to fetch retailers");
        const data = await response.json();
        setRetailers(data);
        setFilteredRetailers(data);
      } catch (err) {
        console.error("Retailers fetch error:", err);
      }
    };
    fetchRetailers();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.dealer_id) return;
    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const response = await fetch(`${apiUrl}/products?dealerid=${user.dealer_id}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error("Failed to fetch products");
        const data = await response.json();
        const formatted = (data.products || data).map((p: any) => ({
          id: String(p.id),
          name: p.name,
          brand: p.brand,
          model: p.model,
          price: Number(p.price),
          stock: Number(p.stock),
          description: p.description,
          dealerid: p.dealerid,
          created_at: p.created_at,
          image: p.image,
        }));
        setProducts(formatted);
        setFilteredProducts(formatted);
      } catch (err) {
        console.error("Products fetch error:", err);
      }
    };
    fetchProducts();
  }, [user?.dealer_id]);

  // Live retailer search
  useEffect(() => {
    if (!retailerSearch.trim()) { setFilteredRetailers(retailers); return; }
    const q = retailerSearch.toLowerCase();
    setFilteredRetailers(retailers.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      r.store_name?.toLowerCase().includes(q) ||
      r.phone?.includes(q) ||
      r.address?.toLowerCase().includes(q)
    ));
  }, [retailerSearch, retailers]);

  // Live product search
  useEffect(() => {
    if (!productSearch.trim()) { setFilteredProducts(products); return; }
    const q = productSearch.toLowerCase();
    setFilteredProducts(products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.model.toLowerCase().includes(q)
    ));
  }, [productSearch, products]);

  const handlePlaceOrder = async () => {
    if (!selectedRetailer) return toast.error("Select a customer first!");
    if (cart.items.length === 0) return toast.error("Cart is empty!");
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerId: selectedRetailer.id,
          retailerName: selectedRetailer.name,
          dealerId: user?.dealer_id,
          order_by: user?.role,
          order_by_id: user?.id,
          total: cart.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
          notes: notes || "",
          items: cart.items.map(i => ({
            productId: i.product.id,
            quantity: i.quantity,
            price: i.product.price,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to submit order");
      clearCart();
      setIsOrderConfirmOpen(false);
      setNotes("");
      localStorage.removeItem("selectedRetailer");
      toast.success("Order submitted successfully!");
      navigate("/staff/sales_report");
    } catch (err) {
      console.error("Order submission error:", err);
      toast.error("Failed to submit order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cartTotal = cart.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

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

        {/* ✅ pt-16 */}
        <div className="flex-1 overflow-y-auto pt-16">
          <div className="container mx-auto px-4 py-6">

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Create Order</h1>
              <p className="text-gray-500 text-sm mt-1">Select a customer and add products to cart</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              {isMobile ? (
                <ScrollArea className="w-full pb-2">
                  <TabsList className="flex w-max mb-4 bg-white border shadow-sm">
                    <TabsTrigger value="retailers" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                      <User size={14} /> Customers
                    </TabsTrigger>
                    <TabsTrigger value="order" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                      <Package size={14} /> Create Order
                    </TabsTrigger>
                  </TabsList>
                </ScrollArea>
              ) : (
                <TabsList className="mb-6 bg-white border shadow-sm">
                  <TabsTrigger value="retailers" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <User size={14} /> Customers
                  </TabsTrigger>
                  <TabsTrigger value="order" className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    <Package size={14} /> Create Order
                  </TabsTrigger>
                </TabsList>
              )}

              {/* ── Customers Tab ── */}
              <TabsContent value="retailers">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Select Customer</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{retailers.length} customers assigned to you</p>
                  </div>
                  {selectedRetailer && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 gap-1.5">
                      <Store size={12} /> {selectedRetailer.store_name} selected
                    </Badge>
                  )}
                </div>

                {/* Search */}
                <div className="relative mb-4 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search customers..."
                    value={retailerSearch}
                    onChange={(e) => setRetailerSearch(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRetailers.map((r, index) => {
                    const isSelected = selectedRetailer?.id === r.id;
                    return (
                      <Card
                        key={r.id}
                        onClick={() => {
                          setSelectedRetailer(r);
                          localStorage.setItem("selectedRetailer", JSON.stringify(r));
                        }}
                        className={`p-4 cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? "border-blue-500 border-2 bg-blue-50 shadow-md"
                            : "hover:shadow-md hover:border-blue-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColors[index % avatarColors.length]}`}>
                            {r.store_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-gray-900 text-sm truncate">{r.store_name}</p>
                              {isSelected && <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{r.name}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1 truncate">
                              <MapPin size={10} /> {r.address}
                            </p>
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Phone size={10} /> {r.phone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                          <Button
                            size="sm"
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRetailer(r);
                              localStorage.setItem("selectedRetailer", JSON.stringify(r));
                              setActiveTab("order");
                            }}
                          >
                            <ShoppingCart size={12} className="mr-1" /> Create Order
                          </Button>
                          <a
                            href={`tel:${r.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                          >
                            <Phone size={13} />
                          </a>
                          <a
                            href={`https://www.google.com/maps?q=${encodeURIComponent(r.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 flex items-center justify-center rounded-md bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                          >
                            <MapPin size={13} />
                          </a>
                        </div>
                      </Card>
                    );
                  })}

                  {filteredRetailers.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-gray-400">
                      <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No customers found</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Create Order Tab ── */}
              <TabsContent value="order">
                {!selectedRetailer ? (
                  <div className="mb-5 flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                    <span className="text-yellow-500 text-lg">⚠️</span>
                    <p className="text-sm text-yellow-700">Please select a customer from the <strong>Customers</strong> tab first.</p>
                    <Button size="sm" variant="outline" className="ml-auto border-yellow-300 text-yellow-700 hover:bg-yellow-100" onClick={() => setActiveTab("retailers")}>
                      Go to Customers
                    </Button>
                  </div>
                ) : (
                  <div className="mb-5 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                      {selectedRetailer.store_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">{selectedRetailer.store_name}</p>
                      <p className="text-xs text-blue-600">{selectedRetailer.name} · {selectedRetailer.phone}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-100 text-xs" onClick={() => setActiveTab("retailers")}>
                      Change
                    </Button>
                  </div>
                )}

                {/* Product Search */}
                <div className="relative max-w-md mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, brand, or model..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => <ProductCard key={p.id} product={p} />)
                  ) : (
                    <div className="col-span-3 text-center py-16 text-gray-400">
                      <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No products found.</p>
                    </div>
                  )}
                </div>

                {/* Cart Summary */}
                {cart.items.length > 0 && (
                  <Card className="mt-6 p-5 shadow-md bg-white border-gray-100 max-w-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <ShoppingCart size={16} className="text-blue-600" /> Cart Summary
                      </h3>
                      <Badge variant="secondary" className="text-xs">{cart.items.length} item{cart.items.length !== 1 ? "s" : ""}</Badge>
                    </div>

                    <ul className="divide-y divide-gray-50 mb-4">
                      {cart.items.map((item) => (
                        <li key={item.product.id} className="py-2 flex justify-between items-center gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm text-gray-800 truncate">{item.product.name}</span>
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                              <button onClick={() => handleQuantityChange(item.product.id, -1, item.quantity)} className="px-2 py-1 text-gray-500 hover:bg-gray-50 transition-colors">
                                <Minus size={11} />
                              </button>
                              <span className="px-2 text-xs font-medium text-gray-800">{item.quantity}</span>
                              <button onClick={() => handleQuantityChange(item.product.id, 1, item.quantity)} className="px-2 py-1 text-gray-500 hover:bg-gray-50 transition-colors">
                                <Plus size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm font-semibold text-gray-900">₹{(item.product.price * item.quantity).toLocaleString("en-IN")}</span>
                            <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <Separator className="my-3" />
                    <div className="flex justify-between font-bold text-gray-900 text-sm mb-4">
                      <span>Total</span>
                      <span className="text-blue-600 text-base">₹{cartTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <Button
                      onClick={() => setIsOrderConfirmOpen(true)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                      disabled={!selectedRetailer}
                    >
                      <ShoppingCart size={15} />
                      {selectedRetailer ? "Place Order" : "Select a Customer First"}
                    </Button>
                  </Card>
                )}
              </TabsContent>
            </Tabs>

            {/* Order Confirmation Dialog */}
            <Dialog open={isOrderConfirmOpen} onOpenChange={setIsOrderConfirmOpen}>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </div>
                    Confirm Order
                  </DialogTitle>
                  <DialogDescription>Review your order before submitting.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  {selectedRetailer && (
                    <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-3 py-2">
                      <Store size={15} className="text-blue-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">{selectedRetailer.store_name}</p>
                        <p className="text-xs text-blue-600">{selectedRetailer.name}</p>
                      </div>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {cart.items.map((item) => (
                      <div key={item.product.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.product.name} <span className="text-gray-400">×{item.quantity}</span></span>
                        <span className="font-medium text-gray-900">₹{(item.product.price * item.quantity).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>Total</span>
                    <span className="text-blue-600">₹{cartTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                    <Textarea placeholder="Add special instructions..." value={notes} onChange={(e) => setNotes(e.target.value)} className="h-20 resize-none" />
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsOrderConfirmOpen(false)}>Cancel</Button>
                  <Button onClick={handlePlaceOrder} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Order"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesExecutiveDashboard;
