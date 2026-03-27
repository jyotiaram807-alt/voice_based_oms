import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import SearchBar from "@/components/SearchBar";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { Product } from "@/types";
import { apiUrl } from "@/url";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Minus, Plus, Trash2, Phone, MapPin, Mic, Search } from "lucide-react";
import { useCart } from "@/context/CartContext";
import Sidebar from "@/components/Sidebar";
import { useVoiceOrder } from "@/hooks/useVoiceOrder";
import VoiceMicButton from "@/components/voice/VoiceMicButton";
import VoiceFallbackModal from "@/components/voice/VoiceFallbackModal";
import { Badge } from "@/components/ui/badge";

interface Retailer {
  id: number;
  name: string;
  city: string;
  phone: string;
  email: string;
  address: string;
  store_name: string;
}

const TakeOrder = () => {
  const { user, isAuthenticated } = useAuth();
    const { cart, clearCart, updateQuantity, removeFromCart, addToCart} = useCart();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const [filteredRetailers, setFilteredRetailers] = useState<Retailer[]>([]);
    const [retailers, setRetailers] = useState<Retailer[]>([]);
    const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [activeTab, setActiveTab] = useState<string>("retailers");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notes, setNotes] = useState("");
    const [isOrderConfirmOpen, setIsOrderConfirmOpen] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productsError, setProductsError] = useState("");
    const [showFallbackModal, setShowFallbackModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
  


  // Auth protection
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }
    if (user?.role !== "dealer") {
      navigate("/retailer/dashboard");
      return;
    }
  }, [isAuthenticated, user, navigate]);

  // 📦 Fetch retailers for this executive
  useEffect(() => {
    if (!user?.id) return;

    const fetchRetailers = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("Unauthorized: Token not found");
          return;
        }

        const response = await fetch(`${apiUrl}/retailers?dealerid=${user.id}`, {
          headers: {
            "Authorization": `Bearer ${token}`, // ✅ Secure JWT
            "Content-Type": "application/json",
          },
        });

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


  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);

        const response = await fetch("https://oms.seerweberp.com/api/products?dealerid=10019"); // 🔥 change to your API
        if (!response.ok) throw new Error("Failed to fetch products");

        const data = await response.json();

        // If API returns { products: [...] }
        const rawProducts = data.products || data;

          const normalizedProducts = rawProducts.map((p: any) => ({
            ...p,
            price: Number(p.price), // ✅ force price to number
          }));

          setProducts(normalizedProducts);

      } catch (error) {
        console.error(error);
        setProductsError("Unable to load products");
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  const {
    voiceState,
    rawTranscript,
    parseResult,
    errorMessage,
    startListening,
    stopListening,
    reprocessTranscript,
    reset: resetVoice,
  } = useVoiceOrder({ products });


  // Search retailers
  const handleRetailerSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredRetailers(retailers);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = retailers.filter(
      (r) =>
        r.name.toLowerCase().includes(lowerQuery) ||
        r.address.toLowerCase().includes(lowerQuery) ||
        r.phone.toLowerCase().includes(lowerQuery) ||
        r.store_name.toLowerCase().includes(lowerQuery)
    );
    setFilteredRetailers(filtered);
  };

  // Filter products
  const filteredProducts = searchQuery.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.model.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products;

  // Handle voice state changes
  const handleVoiceStart = useCallback(() => {
    resetVoice();
    startListening();
  }, [resetVoice, startListening]);

  // Auto-add high confidence items or show fallback
  const handleVoiceAutoAdd = useCallback(() => {
    if (!parseResult) return;
    
    if (voiceState === "success") {
      // All items are high confidence - add them directly
      let addedCount = 0;
      parseResult.parsed.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          addToCart(product, item.quantity);
          addedCount++;
        }
      });
      if (addedCount > 0) {
        toast.success(`✅ Added ${addedCount} product(s) to cart`);
      }
      resetVoice();
    } else if (voiceState === "fallback" || voiceState === "error") {
      setShowFallbackModal(true);
    }
  }, [parseResult, voiceState, products, addToCart, resetVoice]);

  // Effect: auto-process when voice state changes
  if (voiceState === "success" && parseResult && !showFallbackModal) {
    // Use setTimeout to avoid calling during render
    setTimeout(() => handleVoiceAutoAdd(), 0);
  }
  if ((voiceState === "fallback" || (voiceState === "error" && rawTranscript)) && !showFallbackModal) {
    setTimeout(() => setShowFallbackModal(true), 0);
  }

  useEffect(() => {
  if (voiceState === "success" && parseResult && !showFallbackModal) {
    handleVoiceAutoAdd();
  }

  if (
    (voiceState === "fallback" ||
      (voiceState === "error" && rawTranscript)) &&
    !showFallbackModal
  ) {
    setShowFallbackModal(true);
  }
}, [voiceState, parseResult, rawTranscript]);

  // Handle confirmed items from fallback modal
  const handleConfirmItems = (items: { productId: string; quantity: number }[]) => {
    let addedCount = 0;
    items.forEach(({ productId, quantity }) => {
      const product = products.find((p) => p.id === productId);
      if (product) {
        addToCart(product, quantity);
        addedCount++;
      }
    });
    if (addedCount > 0) {
      toast.success(`✅ Added ${addedCount} product(s) to cart`);
    }
    resetVoice();
  };


  const cartTotal = cart.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  // Search products

  // Cart quantity change
  const handleQuantityChange = (productId: string, change: number, currentQty: number) => {
    const newQty = currentQty + change;
    if (newQty >= 1) updateQuantity(productId, newQty);
  };

  // Place order
  const handlePlaceOrder = async () => {
    if (!selectedRetailer) return alert("Select a Customer first!");
    if (cart.items.length === 0) return alert("Cart is empty!");

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          retailerId: selectedRetailer.id,
          retailerName: selectedRetailer.name,
          dealerId: user?.id,
          order_by: user?.role,
          order_by_id: user?.id,
          total: cart.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
          notes: notes || "",
          items: cart.items.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            price: i.product.price,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to submit order");
      const response = await res.json();
      console.log("Order created:", response);
      clearCart();
      setIsOrderConfirmOpen(false);
      setNotes("");
      toast.success("Order submitted successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit order.");
    } finally {
      setIsSubmitting(false);
    }
  };


  return (

    <div className="flex h-screen overflow-hidden">
      <div className="w-64 fixed top-0 left-0 h-full">
        <Sidebar />
      </div>

      <div className="flex-1 ml-64 flex flex-col">
        <Navbar />
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 mt-4">
            <div className="container mx-auto px-4 py-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                {isMobile ? (
                  <ScrollArea className="w-full pb-2">
                    <TabsList className="flex w-max">
                      <TabsTrigger value="retailers">Customers</TabsTrigger>
                      <TabsTrigger value="order">Create Order</TabsTrigger>
                    </TabsList>
                  </ScrollArea>
                ) : (
                  <TabsList className="mb-4">
                    <TabsTrigger value="retailers">Customers</TabsTrigger>
                    <TabsTrigger value="order">Create Order</TabsTrigger>
                  </TabsList>
                )}

                {/* Customers Tab */}
                <TabsContent value="retailers">
                  <h2 className="text-2xl font-bold mb-4">Customers</h2>
                  <SearchBar onSearch={handleRetailerSearch} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {filteredRetailers.map((r) => (
                      <Card
                        key={r.id}
                        onClick={() => setSelectedRetailer(r)}
                        className={`relative p-4 cursor-pointer transition ${
                          selectedRetailer?.id === r.id
                            ? "border-blue-500 shadow-lg"
                            : "hover:shadow"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{r.store_name}</p>
                            <p className="text-sm text-gray-500">
                              {r.name} ({r.phone})
                            </p>
                            <p className="text-sm text-gray-500">{r.address}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // prevent card click
                                setSelectedRetailer(r); // select retailer if needed
                                setActiveTab("order"); // switch to order tab
                              }}
                              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition"
                            >
                              Create Order
                            </button>

                            <a
                              href={`tel:${r.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="sm:hidden flex items-center justify-center bg-blue-500 text-white rounded-full p-2 hover:bg-blue-600 transition"
                            >
                              <Phone size={18} />
                            </a>
                            <a
                              href={`https://www.google.com/maps?q=${encodeURIComponent(
                                r.address
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center justify-center bg-green-500 text-white rounded-full p-2 hover:bg-green-600 transition"
                            >
                              <MapPin size={18} />
                            </a>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* Order Tab */}
                <TabsContent value="order">
                  <h2 className="text-2xl font-bold mb-4 text-foreground">
                    Create Order
                  </h2>

                  {/* Search bar + Voice button */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by name, brand, or model..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <VoiceMicButton
                      voiceState={voiceState}
                      onStart={handleVoiceStart}
                      onStop={stopListening}
                    />
                  </div>

                  {/* Live transcript display */}
                  {(voiceState === "listening" || voiceState === "processing") &&
                    rawTranscript && (
                      <div className="mb-4 p-3 rounded-lg bg-muted animate-in fade-in duration-300">
                        <p className="text-xs text-muted-foreground mb-1">
                          {voiceState === "listening" ? "Hearing:" : "Processing:"}
                        </p>
                        <p className="text-sm italic text-foreground">
                          "{rawTranscript}"
                        </p>
                      </div>
                    )}

                  {/* Error display (for errors without transcript) */}
                  {voiceState === "error" && !rawTranscript && errorMessage && (
                    <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-in fade-in duration-300">
                      <p className="text-sm text-destructive">{errorMessage}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={resetVoice}
                      >
                        Try Again
                      </Button>
                    </div>
                  )}

                  {/* Product Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredProducts.map((product) => {
                      const cartItem = cart.items.find(
                        (i) => i.product.id === product.id
                      );
                      return (
                        <Card
                          key={product.id}
                          className="p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-sm text-foreground">
                                {product.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {product.brand} • {product.model}
                              </p>
                            </div>
                            <span className="font-bold text-primary text-sm">
                              ₹{product.price.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <Badge variant="secondary" className="text-xs">
                              Stock: {product.stock}
                            </Badge>
                            {cartItem ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() =>
                                    handleQuantityChange(
                                      product.id,
                                      -1,
                                      cartItem.quantity
                                    )
                                  }
                                >
                                  <Minus size={12} />
                                </Button>
                                <span className="text-sm w-8 text-center font-medium">
                                  {cartItem.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() =>
                                    handleQuantityChange(
                                      product.id,
                                      1,
                                      cartItem.quantity
                                    )
                                  }
                                >
                                  <Plus size={12} />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => addToCart(product, 1)}
                              >
                                <Plus size={14} className="mr-1" />
                                Add
                              </Button>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>

                  {filteredProducts.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">
                      No products found.
                    </p>
                  )}

                  {/* Cart Summary */}
                  {cart.items.length > 0 && (
                    <Card className="mt-6 p-4 shadow-md max-w-lg">
                      <h3 className="text-lg font-bold mb-3 text-foreground">
                        Cart Summary
                      </h3>
                      <ul className="divide-y divide-border mb-4">
                        {cart.items.map((item) => (
                          <li
                            key={item.product.id}
                            className="py-2 flex justify-between items-center"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-foreground">
                                {item.product.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() =>
                                    handleQuantityChange(
                                      item.product.id,
                                      -1,
                                      item.quantity
                                    )
                                  }
                                  className="p-1 border rounded hover:bg-muted"
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="px-2 text-sm">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    handleQuantityChange(
                                      item.product.id,
                                      1,
                                      item.quantity
                                    )
                                  }
                                  className="p-1 border rounded hover:bg-muted"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">
                                ₹
                                {(
                                  item.product.price * item.quantity
                                ).toLocaleString("en-IN")}
                              </span>
                              <button
                                onClick={() => removeFromCart(item.product.id)}
                                className="text-destructive hover:text-destructive/80"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-semibold text-foreground">
                        <span>Total</span>
                        <span>
                          ₹
                          {cartTotal.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <Button
                        onClick={() => setIsOrderConfirmOpen(true)}
                        className="w-full mt-4"
                      >
                        Place Order
                      </Button>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>

              <VoiceFallbackModal
                open={showFallbackModal}
                onClose={() => {
                  setShowFallbackModal(false);
                  resetVoice();
                }}
                parseResult={parseResult}
                rawTranscript={rawTranscript}
                products={products}
                onReprocess={reprocessTranscript}
                onConfirmItems={handleConfirmItems}
                errorMessage={errorMessage}
              />

              {/* Order Confirmation Dialog */}
              <Dialog
                open={isOrderConfirmOpen}
                onOpenChange={setIsOrderConfirmOpen}
              >
                <DialogContent className="w-[90%] sm:w-[80%] md:w-[70%] lg:w-[50%] max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Confirm Order</DialogTitle>
                    <DialogDescription>
                      Review your order details before submitting.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <h3 className="font-medium">Order Items</h3>
                      <div className="text-sm space-y-1">
                        {cart.items.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex justify-between"
                          >
                            <span>
                              {item.product.name} x {item.quantity}
                            </span>
                            <span>
                              ₹{(item.product.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span>
                          ₹
                          {cart.items
                            .reduce(
                              (sum, item) =>
                                sum + item.product.price * item.quantity,
                              0
                            )
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="notes" className="text-sm font-medium">
                        Order Notes (Optional)
                      </label>
                      <Textarea
                        id="notes"
                        placeholder="Add any special instructions or notes here..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="h-24"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsOrderConfirmOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handlePlaceOrder}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit Order"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeOrder;