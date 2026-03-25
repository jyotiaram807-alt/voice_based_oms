import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Product, ProductVariant } from "@/types";
import { apiUrl } from "@/url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Minus, Plus, Trash2, Search, ShoppingCart,
  Package, SlidersHorizontal, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/imageUrl";

type QtyState = Record<string, Record<number, string>>;

function resolveProductColor(product: Partial<Product>): string {
  const c = (product as any).color || product.attributes?.color || "";
  return String(c).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
const RetailerHome = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const {
    cart, addToCart, addVariantToCart,
    removeFromCart, removeVariant,
    updateQuantity, updateVariantQty,
    clearCart, cartCount, cartTotal,
  } = useCart();
  const navigate = useNavigate();

  const [products, setProducts]             = useState<Product[]>([]);
  const [fetching, setFetching]             = useState(true);
  const [isCartOpen, setIsCartOpen]         = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [searchQuery, setSearchQuery]       = useState("");
  const [filterBrand, setFilterBrand]       = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterDesign, setFilterDesign]     = useState("");
  const [qtyState, setQtyState]             = useState<QtyState>({});
  const [imgErrors, setImgErrors]           = useState<Record<string, boolean>>({});

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { navigate("/"); return; }
    if (user?.role !== "retailer") navigate("/dealer");
  }, [loading, isAuthenticated, user, navigate]);

  // ── Fetch products ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !isAuthenticated || user?.role !== "retailer" || !user?.dealer_id) return;
    setFetching(true);
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${apiUrl}/products?dealerid=${user.dealer_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();

        const formatted: Product[] = data.map((item: any) => {
          let attrs: Record<string, string> = {};
          if (item.attributes) {
            attrs = typeof item.attributes === "string"
              ? JSON.parse(item.attributes)
              : item.attributes;
          }
          return {
            id:               String(item.id),
            name:             item.name || "",
            brand:            item.brand || attrs.brand || "",
            model:            item.model || attrs.model || "",
            color:            item.color || attrs.color || "",
            price:            Number(item.price),
            stock:            Number(item.stock),
            description:      item.description || "",
            dealer_id:        Number(item.dealerid),
            dealerid:         Number(item.dealerid),
            image:            item.image || null,
            attributes:       attrs,
            business_type_id: item.business_type_id ?? null,
            variants: (item.variants ?? []).map((v: any) => ({
              ...v,
              color: v.color || item.color || attrs.color || "",
            })),
          };
        });

        setProducts(formatted);

        const initQty: QtyState = {};
        formatted.forEach((p) => {
          initQty[p.id] = {};
          (p.variants ?? []).forEach((v) => {
            initQty[p.id][v.id] = String(v.qty);
          });
        });
        setQtyState(initQty);
      } catch {
        toast.error("Failed to load products");
      } finally {
        setFetching(false);
      }
    })();
  }, [loading, isAuthenticated, user]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const brands = useMemo(() => {
    const s = new Set(products.map((p) => p.attributes?.brand || p.brand).filter(Boolean));
    return Array.from(s).sort();
  }, [products]);

  const categories = useMemo(() => {
    const s = new Set(
      products.map((p) => p.attributes?.category || p.attributes?.master_category || "").filter(Boolean)
    );
    return Array.from(s).sort();
  }, [products]);

  const filtered = useMemo(() => products.filter((p) => {
    const q = searchQuery.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) &&
      !Object.values(p.attributes ?? {}).some((v) => String(v).toLowerCase().includes(q)))
      return false;
    if (filterBrand !== "all" && (p.attributes?.brand || p.brand) !== filterBrand) return false;
    if (filterCategory !== "all") {
      const c = p.attributes?.category || p.attributes?.master_category;
      if (c !== filterCategory) return false;
    }
    if (filterDesign && !p.name.toLowerCase().includes(filterDesign.toLowerCase())) return false;
    return true;
  }), [products, searchQuery, filterBrand, filterCategory, filterDesign]);

  const resetFilters = () => {
    setSearchQuery(""); setFilterBrand("all");
    setFilterCategory("all"); setFilterDesign("");
  };

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const getCartVariant = (productId: string, variantId: number) =>
    cart.items.find((i) => i.productId === productId)
      ?.variants.find((v) => v.variantId === variantId) ?? null;

  const getCartSimple = (productId: string) =>
    cart.items.find((i) => i.productId === productId)
      ?.variants.find((v) => v.variantId === 0) ?? null;

  const handleAddVariant = (p: Product, variant: ProductVariant) => {
    const qty = parseInt(qtyState[p.id]?.[variant.id] ?? String(variant.qty), 10);
    if (isNaN(qty) || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    if (qty > variant.qty) { toast.error(`Only ${variant.qty} in stock`); return; }
    addVariantToCart(p, variant, qty);
    setQtyState((prev) => ({
      ...prev,
      [p.id]: { ...prev[p.id], [variant.id]: String(variant.qty) },
    }));
    setIsCartOpen(true);
  };

  // ── Place order ──────────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!cart.items.length) { toast.error("Cart is empty"); return; }
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const orderItems = cart.items.flatMap((item) =>
        item.variants.map((v) => ({
          productId:           item.productId,
          variantId:           v.variantId,
          size:                v.size,
          color:               v.color,
          quantity:            v.quantity,
          price:               v.price,
          subtotal:            v.price * v.quantity,
          rack:                v.rack || "",
          attributes_snapshot: {
            ...item.attributes,
            brand:            item.brand,
            model:            item.model || "",
            business_type_id: item.businessTypeId,
          },
        }))
      );
      const res = await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerId:   user?.id,
          retailerName: user?.name,
          dealerId:     user?.dealer_id,
          total:        cartTotal,
          items:        orderItems,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Order placed successfully!");
      clearCart();
      setIsCartOpen(false);
    } catch {
      toast.error("Failed to place order");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !isAuthenticated || user?.role !== "retailer") {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600 font-semibold">
        Loading...
      </div>
    );
  }

  const showSize = Number(user.business_type_id) === 2;

  // ── Grid template strings — defined once, used consistently in both header and rows
  // With size:    [size-badge] [price] [qty-input] [add/action-btn]
  // Without size: [price] [qty-input] [add/action-btn]
  //
  // KEY FIX: replaced the old fixed "70px" button column (too narrow) with "minmax(52px,auto)"
  // so the Add / trash button always has enough room. Also changed row gap from "gap-6"
  // (24 px — way too wide, was pushing the button out of the card) to "gap-2" (8 px).
  const gridWithSize    = "grid-cols-[36px_1fr_52px_minmax(52px,auto)]";
  const gridWithoutSize = "grid-cols-[1fr_52px_minmax(52px,auto)]";

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-64 fixed top-0 left-0 h-full z-10"><Sidebar /></div>

      <div className="flex-1 ml-64 flex flex-col">
        <Navbar />
        <div className="flex-1 overflow-y-auto pt-16">
          <div className="container mx-auto px-4 py-5 max-w-7xl">

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
              <div>
                <h1 className="text-xl font-bold text-gray-900">Place Order</h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {fetching
                    ? "Loading…"
                    : `${filtered.length} product${filtered.length !== 1 ? "s" : ""} available`}
                </p>
              </div>

            </div>

            {/* ── Filters ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <SlidersHorizontal size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Filters</span>
                {(filterBrand !== "all" || filterCategory !== "all" || filterDesign || searchQuery) && (
                  <button onClick={resetFilters} className="ml-auto flex items-center gap-1 text-xs text-blue-600">
                    <RefreshCw size={11} /> Reset
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative col-span-2 md:col-span-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Search products…" value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-sm bg-gray-50" />
                </div>
                {brands.length > 0 && (
                  <Select value={filterBrand} onValueChange={setFilterBrand}>
                    <SelectTrigger className="h-9 text-sm bg-gray-50"><SelectValue placeholder="Brand" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Brands</SelectItem>
                      {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {categories.length > 0 && (
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-9 text-sm bg-gray-50"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <Input placeholder="Search by design…" value={filterDesign}
                  onChange={(e) => setFilterDesign(e.target.value)}
                  className="h-9 text-sm bg-gray-50" />
              </div>
            </div>

            {/* ── Product grid ── */}
            {fetching ? (
              <div className="text-center py-16 text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30 animate-pulse" />
                <p className="text-sm">Loading catalog…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No products found</p>
                <button onClick={resetFilters} className="text-xs text-blue-600 hover:underline mt-2">Clear filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
                {filtered.map((product) => {
                  const hasVariants  = (product.variants ?? []).length > 0;
                  const imageUrl     = getImageUrl(product.image);
                  const productColor = resolveProductColor(product);
                  const attrPills    = Object.entries(product.attributes ?? {})
                    .filter(([k, v]) => v && !["mrp","size","color","brand","model"].includes(k))
                    .slice(0, 2);
                  const inCartCount  = cart.items.find((i) => i.productId === product.id)
                    ?.variants.reduce((s, v) => s + v.quantity, 0) ?? 0;

                  // Pick the grid template for this product's cards
                  const gridCols = showSize ? gridWithSize : gridWithoutSize;

                  return (
                    <div
                      key={product.id}
                      className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-all duration-200 ${
                        inCartCount > 0
                          ? "border-blue-300 ring-1 ring-blue-100"
                          : "border-gray-100 hover:border-blue-200"
                      }`}
                    >
                      {imageUrl && !imgErrors[product.id] ? (
                        <div className="w-full h-44 bg-gray-50 border-b overflow-hidden flex-shrink-0">
                          <img
                            src={imageUrl} alt={product.name}
                            onError={() => setImgErrors((p) => ({ ...p, [product.id]: true }))}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-44 bg-gradient-to-br from-gray-50 to-gray-100 border-b flex items-center justify-center flex-shrink-0">
                          <Package className="h-10 w-10 text-gray-200" />
                        </div>
                      )}

                      <div className="p-3 flex flex-col flex-1 gap-2">
                        {/* Name + price */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900">
                              <span className="text-[11px] text-gray-400">Name: </span>
                              <span className="text-xs text-gray-900 items-center">{product.name}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <label className="text-[10px] text-gray-400">Brand:</label>
                              {(product.brand || product.attributes?.brand) && (
                                <span className="text-[11px] text-gray-900 items-center">
                                  {product.attributes?.brand || product.brand}
                                </span>
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">Color: </label>
                              {productColor && (
                                <span className="text-[12px] text-gray-900 items-center">
                                  {productColor}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <span className="text-sm font-bold text-blue-600">
                              ₹{product.price.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>

                        {/* Attribute pills */}
                        {attrPills.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {attrPills.map(([k, v]) => (
                              <span
                                key={k}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize"
                              >
                                {k} : {v}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* ── Variant table ── */}
                        {hasVariants ? (
                          <div className="mt-1 flex flex-col flex-1">
                            {/*
                              HEADER ROW
                              Uses the same gridCols template as the data rows so columns
                              always line up. Gap is gap-2 (was gap-4 in header / gap-6 in
                              rows — the mismatch was part of why the button overflowed).
                            */}
                            <div className={`grid ${gridCols} gap-2 text-[9px] font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1`}>
                              {showSize && <span>Size</span>}
                              <span>Price</span>
                              <span className="text-center">Qty</span>
                              <span />
                            </div>

                            <div className="space-y-1 flex-1">
                              {(product.variants ?? []).map((variant) => {
                                const cv         = getCartVariant(product.id, variant.id);
                                const outOfStock = variant.qty === 0;
                                const curQty     = qtyState[product.id]?.[variant.id] ?? String(variant.qty);

                                return (
                                  <div
                                    key={variant.id}
                                    /*
                                      KEY FIX — gap-2 instead of gap-6.
                                      gap-6 = 24 px between every column; with 4 columns that
                                      consumed 72 px of gap alone, leaving the rightmost "Add"
                                      button with no room and causing it to be clipped by the
                                      card's overflow:hidden.  gap-2 = 8 px total (24 px saved).
                                    */
                                    className={`grid ${gridCols} gap-2 items-center px-1.5 py-1 rounded-lg ${
                                      cv ? "bg-blue-50 border border-blue-200"
                                        : outOfStock ? "bg-gray-50 opacity-50"
                                        : "bg-gray-50 border border-transparent"
                                    }`}
                                  >
                                    {/* Size badge — only for showSize */}
                                    {showSize && (
                                      <span className={`text-[10px] font-bold text-center px-1 py-0.5 rounded ${
                                        cv ? "bg-blue-600 text-white" : "bg-white text-gray-700 border border-gray-200"
                                      }`}>
                                        {variant.size || "—"}
                                      </span>
                                    )}

                                    {/* Price */}
                                    <div>
                                      <p className="text-xs font-semibold text-gray-800">
                                        ₹{(variant.rate || variant.mrp || product.price).toLocaleString("en-IN")}
                                      </p>
                                    </div>

                                    {/* Qty — stepper when in cart, input when not */}
                                    {cv ? (
                                      <div className="flex items-center justify-center border border-blue-300 rounded overflow-hidden bg-white">
                                        <button
                                          onClick={() => updateVariantQty(product.id, variant.id, cv.quantity - 1)}
                                          className="px-1 py-0.5 text-blue-600 hover:bg-blue-50"
                                        >
                                          <Minus size={9} />
                                        </button>
                                        <span className="text-xs font-bold text-blue-700 min-w-[16px] text-center">
                                          {cv.quantity}
                                        </span>
                                        <button
                                          onClick={() => updateVariantQty(product.id, variant.id, cv.quantity + 1)}
                                          disabled={cv.quantity >= variant.qty}
                                          className="px-1 py-0.5 text-blue-600 hover:bg-blue-50 disabled:opacity-30"
                                        >
                                          <Plus size={9} />
                                        </button>
                                      </div>
                                    ) : (
                                      <input
                                        type="number" min="1" max={variant.qty}
                                        value={curQty} disabled={outOfStock}
                                        onChange={(e) => setQtyState((prev) => ({
                                          ...prev,
                                          [product.id]: { ...prev[product.id], [variant.id]: e.target.value },
                                        }))}
                                        className="w-full text-center text-xs font-medium text-gray-800 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 py-0.5 disabled:opacity-40"
                                      />
                                    )}

                                    {/* Add / Remove button */}
                                    {cv ? (
                                      <button
                                        onClick={() => removeVariant(product.id, variant.id)}
                                        className="flex items-center justify-center h-6 w-6 mx-auto rounded text-red-400 hover:bg-red-50"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleAddVariant(product, variant)}
                                        disabled={outOfStock}
                                        className="w-full text-[9px] px-1 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold disabled:opacity-30 transition-colors text-center whitespace-nowrap"
                                      >
                                        {outOfStock ? "Out" : "Add"}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[9px] text-gray-400 mt-1.5 text-right">
                              {(product.variants ?? []).reduce((s, v) => s + v.qty, 0)} units ·{" "}
                              {(product.variants ?? []).length} sizes
                            </p>
                          </div>
                        ) : (
                          /* simple product */
                          <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                            {product.stock === 0 ? (
                              <Badge variant="outline" className="text-red-500 border-red-200 text-xs">Out of Stock</Badge>
                            ) : (
                              <Badge variant="secondary" className={`text-xs font-medium ${
                                product.stock <= 5
                                  ? "bg-orange-50 text-orange-600 border border-orange-200"
                                  : "bg-green-50 text-green-700 border border-green-200"
                              }`}>
                                {product.stock <= 5 ? `Only ${product.stock} left` : `Stock: ${product.stock}`}
                              </Badge>
                            )}
                            {(() => {
                              const cv = getCartSimple(product.id);
                              return cv ? (
                                <div className="flex items-center border border-blue-300 rounded-lg overflow-hidden bg-blue-50">
                                  <button onClick={() => updateQuantity(product.id, cv.quantity - 1)}
                                    className="px-2 py-1.5 text-blue-600 hover:bg-blue-100">
                                    <Minus size={11} />
                                  </button>
                                  <span className="px-2 text-sm font-bold text-blue-700 min-w-[24px] text-center">
                                    {cv.quantity}
                                  </span>
                                  <button onClick={() => updateQuantity(product.id, cv.quantity + 1)}
                                    disabled={cv.quantity >= product.stock}
                                    className="px-2 py-1.5 text-blue-600 hover:bg-blue-100 disabled:opacity-30">
                                    <Plus size={11} />
                                  </button>
                                </div>
                              ) : (
                                <Button size="sm"
                                  onClick={() => { addToCart(product, 1); setIsCartOpen(true); }}
                                  disabled={product.stock === 0}
                                  className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-xs gap-1">
                                  <Plus size={11} /> Add
                                </Button>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Business-type-aware Cart Drawer ── */}
    </div>
  );
};

export default RetailerHome;
