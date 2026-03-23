import { useEffect, useRef } from "react";
import {
  X, ShoppingCart, Trash2, Plus, Minus, Package,
  ArrowRight, Tag, Layers, ShoppingBag, Smartphone, Shirt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Cart, Product } from "@/types";
import { getCartConfig, getVisibleFields } from "@/lib/Cartbusinessconfig";

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Cart;
  products: Product[];
  cartTotal: number;
  cartCount: number;
  isSubmitting: boolean;
  onPlaceOrder: () => void;
  onRemoveVariant: (productId: string, variantId: number) => void;
  onUpdateVariantQty: (productId: string, variantId: number, qty: number) => void;
  onRemoveProduct: (productId: string) => void;
  getImageUrl: (image: string | null | undefined) => string | null;
}

// ── Render a single attribute pill ────────────────────────────────────────────
function AttrPill({
  label,
  value,
  renderAs,
  accentColor,
}: {
  label: string;
  value: string;
  renderAs?: "badge" | "text" | "color-swatch" | "tag";
  accentColor: string;
}) {
  if (renderAs === "color-swatch") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
        <span
          className="w-2.5 h-2.5 rounded-full border border-gray-300 flex-shrink-0"
          style={{ backgroundColor: value.toLowerCase() }}
        />
        {value}
      </span>
    );
  }
  if (renderAs === "badge") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: `${accentColor}15`,
          color: accentColor,
          border: `1px solid ${accentColor}30`,
        }}
      >
        {value}
      </span>
    );
  }
  if (renderAs === "tag") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
        <Tag size={7} className="text-gray-400" />
        {value}
      </span>
    );
  }
  // default: text
  return (
    <span className="text-[10px] text-gray-400">
      {label}: <span className="text-gray-600 font-medium">{value}</span>
    </span>
  );
}

// ── Business type icon ─────────────────────────────────────────────────────────
function BusinessTypeIcon({ businessTypeId, size = 14 }: { businessTypeId?: number | null; size?: number }) {
  if (businessTypeId === 2) return <Smartphone size={size} />;
  if (businessTypeId === 1) return <Shirt size={size} />;
  return <Package size={size} />;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CartDrawer({
  isOpen,
  onClose,
  cart,
  products,
  cartTotal,
  cartCount,
  isSubmitting,
  onPlaceOrder,
  onRemoveVariant,
  onUpdateVariantQty,
  onRemoveProduct,
  getImageUrl,
}: CartDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const totalPcs = cart.items.reduce(
    (s, i) => s + i.variants.reduce((ss, v) => ss + v.quantity, 0),
    0,
  );

  // Detect dominant business type in cart
  const dominantBusinessTypeId = cart.items[0]?.businessTypeId ?? null;
  const cartConfig = getCartConfig(dominantBusinessTypeId);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          isOpen
            ? "bg-black/40 backdrop-blur-[3px] pointer-events-auto"
            : "bg-transparent pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full z-50 flex flex-col bg-white shadow-2xl
          transition-transform duration-300 ease-in-out w-[400px] max-w-[95vw]
          ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0"
          style={{ borderTopColor: cartConfig.accentColor + "40" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
              style={{ backgroundColor: cartConfig.accentColor }}
            >
              <BusinessTypeIcon businessTypeId={dominantBusinessTypeId} size={16} />
            </div>
            <div>
              <p className="font-bold text-sm text-gray-900 leading-none">
                {cartConfig.name} Order
              </p>
              {cartCount > 0 && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {cart.items.length} product{cart.items.length !== 1 ? "s" : ""} · {totalPcs} {cartConfig.variantConfig.unitLabel}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cartCount > 0 && (
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: cartConfig.accentColor + "15",
                  color: cartConfig.accentColor,
                  border: `1px solid ${cartConfig.accentColor}30`,
                }}
              >
                {cartCount} item{cartCount !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Business type indicator strip ── */}
        {cart.items.length > 0 && (
          <div
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-medium"
            style={{
              backgroundColor: cartConfig.accentColor + "08",
              color: cartConfig.accentColor,
              borderBottom: `1px solid ${cartConfig.accentColor}20`,
            }}
          >
            <BusinessTypeIcon businessTypeId={dominantBusinessTypeId} size={11} />
            <span>{cartConfig.name} · {cartConfig.variantConfig.primaryLabel}-based ordering</span>
          </div>
        )}

        {/* ── Cart items ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6 py-20">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  backgroundColor: cartConfig.accentColor + "10",
                  border: `2px dashed ${cartConfig.accentColor}30`,
                }}
              >
                <BusinessTypeIcon businessTypeId={dominantBusinessTypeId} size={32} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500">Your cart is empty</p>
                <p className="text-xs text-gray-400 mt-1">{cartConfig.emptyCartMessage}</p>
              </div>
            </div>
          ) : (
            cart.items.map((item) => {
              const product = products.find((p) => p.id === item.productId);
              const imageUrl = getImageUrl(product?.image ?? null);

              // Get business-type-aware config for THIS item
              const itemConfig = getCartConfig(item.businessTypeId);

              const productColor =
                (product as any)?.color ||
                product?.attributes?.color ||
                (item as any).attributes?.color ||
                "";

              const visibleFields = getVisibleFields(
                itemConfig,
                item.attributes,
                item.brand,
                productColor,
              );

              const totalAmt = item.variants.reduce((s, v) => s + v.price * v.quantity, 0);
              const totalQty = item.variants.reduce((s, v) => s + v.quantity, 0);

              return (
                <div
                  key={item.productId}
                  className="rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 bg-white"
                  style={{ borderColor: itemConfig.accentColor + "25" }}
                >
                  {/* ── Product row ── */}
                  <div className="flex items-start gap-3 p-3">
                    {/* Thumbnail */}
                    <div
                      className="w-14 h-14 rounded-xl border overflow-hidden flex-shrink-0 flex items-center justify-center"
                      style={{
                        backgroundColor: itemConfig.accentColor + "08",
                        borderColor: itemConfig.accentColor + "20",
                      }}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={(item as any).name ?? "Product"}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <BusinessTypeIcon businessTypeId={item.businessTypeId} size={20} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate leading-snug">
                        {(item as any).name ?? item.productId}
                      </p>

                      {/* Business-type-aware attribute pills */}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {visibleFields.map((field, idx) => (
                          <AttrPill
                            key={idx}
                            label={field.label}
                            value={field.value}
                            renderAs={field.renderAs}
                            accentColor={itemConfig.accentColor}
                          />
                        ))}
                      </div>

                      {/* Summary + price */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] text-gray-400">
                          {item.variants.length} {itemConfig.variantConfig.primaryLabel.toLowerCase()}{item.variants.length !== 1 ? "s" : ""} · {totalQty} {itemConfig.variantConfig.unitLabel}
                        </span>
                        <span
                          className="text-sm font-bold"
                          style={{ color: itemConfig.accentColor }}
                        >
                          ₹{totalAmt.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    {/* Remove all */}
                    <button
                      onClick={() => onRemoveProduct(item.productId)}
                      className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* ── Variant breakdown ── */}
                  <div
                    className="border-t px-3 py-2 space-y-1.5"
                    style={{
                      backgroundColor: itemConfig.accentColor + "05",
                      borderColor: itemConfig.accentColor + "20",
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <Layers size={9} style={{ color: itemConfig.accentColor }} />
                      <p
                        className="text-[9px] font-bold uppercase tracking-widest"
                        style={{ color: itemConfig.accentColor + "90" }}
                      >
                        {itemConfig.variantConfig.primaryLabel} Breakdown
                      </p>
                    </div>

                    {item.variants.map((v) => {
                      const vColor = v.color || productColor;
                      const primaryValue = v.size || "—";

                      // For mobiles, show RAM as secondary; for garments, show color
                      const secondaryValue =
                        itemConfig.businessTypeId === 2
                          ? (item.attributes?.ram || "")  // Mobile: RAM
                          : vColor;                        // Garments: Color

                      return (
                        <div
                          key={v.variantId}
                          className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-2 border hover:border-opacity-60 transition-colors group"
                          style={{ borderColor: itemConfig.accentColor + "25" }}
                        >
                          {/* Primary variant label (Size / Storage) */}
                          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-gray-400 leading-none">
                              {itemConfig.variantConfig.primaryLabel.toUpperCase()}
                            </span>
                            <span
                              className="text-xs font-extrabold px-1.5 py-0.5 rounded-md min-w-[28px] text-center text-white"
                              style={{ backgroundColor: itemConfig.accentColor }}
                            >
                              {primaryValue}
                            </span>
                          </div>

                          {/* Secondary (Color or RAM) */}
                          {secondaryValue && itemConfig.variantConfig.secondaryLabel && (
                            <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                              <span className="text-[9px] text-gray-400 leading-none">
                                {itemConfig.variantConfig.secondaryLabel.toUpperCase()}
                              </span>
                              {itemConfig.businessTypeId === 1 && vColor ? (
                                <span className="flex items-center gap-1 text-[10px] text-gray-600 font-medium">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full border border-gray-200 flex-shrink-0"
                                    style={{ backgroundColor: vColor.toLowerCase() }}
                                  />
                                  <span className="max-w-[44px] truncate">{vColor}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-gray-700">
                                  {secondaryValue}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Price */}
                          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-gray-400 leading-none">PRICE</span>
                            <span className="text-[11px] font-bold text-gray-800">
                              ₹{v.price.toLocaleString("en-IN")}
                            </span>
                          </div>

                          {/* MRP (if config shows it and differs) */}
                          {itemConfig.variantConfig.showMrp && v.mrp && v.mrp !== v.price && (
                            <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
                              <span className="text-[9px] text-gray-400 leading-none">MRP</span>
                              <span className="text-[10px] text-gray-400 line-through">
                                ₹{v.mrp.toLocaleString("en-IN")}
                              </span>
                            </div>
                          )}

                          {/* Stepper */}
                          <div
                            className="ml-auto flex items-center rounded-lg overflow-hidden bg-white shadow-sm border"
                            style={{ borderColor: itemConfig.accentColor + "40" }}
                          >
                            <button
                              onClick={() => onUpdateVariantQty(item.productId, v.variantId, v.quantity - 1)}
                              className="px-2 py-1.5 transition-colors hover:opacity-80"
                              style={{ color: itemConfig.accentColor }}
                            >
                              <Minus size={9} />
                            </button>
                            <span
                              className="text-xs font-extrabold min-w-[24px] text-center"
                              style={{ color: itemConfig.accentColor }}
                            >
                              {v.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateVariantQty(item.productId, v.variantId, v.quantity + 1)}
                              className="px-2 py-1.5 transition-colors hover:opacity-80"
                              style={{ color: itemConfig.accentColor }}
                            >
                              <Plus size={9} />
                            </button>
                          </div>

                          {/* Subtotal */}
                          <span
                            className="text-[11px] font-bold flex-shrink-0 min-w-[52px] text-right"
                            style={{ color: itemConfig.accentColor }}
                          >
                            ₹{(v.price * v.quantity).toLocaleString("en-IN")}
                          </span>

                          {/* Remove variant */}
                          <button
                            onClick={() => onRemoveVariant(item.productId, v.variantId)}
                            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      );
                    })}

                    {/* Variant subtotal */}
                    <div
                      className="flex items-center justify-between pt-1.5 border-t border-dashed"
                      style={{ borderColor: itemConfig.accentColor + "30" }}
                    >
                      <span className="text-[10px] text-gray-400">
                        {totalQty} {itemConfig.variantConfig.unitLabel} · {item.variants.length} {itemConfig.variantConfig.primaryLabel.toLowerCase()}{item.variants.length !== 1 ? "s" : ""}
                      </span>
                      <span
                        className="text-xs font-extrabold"
                        style={{ color: itemConfig.accentColor }}
                      >
                        ₹{totalAmt.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {cart.items.length > 0 && (
          <div className="border-t border-gray-100 flex-shrink-0 bg-white">
            {/* Order summary */}
            <div
              className="px-5 py-3 border-b"
              style={{
                backgroundColor: cartConfig.accentColor + "08",
                borderColor: cartConfig.accentColor + "20",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">
                  {cart.items.length} product{cart.items.length !== 1 ? "s" : ""} · {totalPcs} {cartConfig.variantConfig.unitLabel}
                </span>
                <span className="text-xs text-gray-500">Subtotal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold text-gray-900">Total</span>
                <span
                  className="text-xl font-extrabold"
                  style={{ color: cartConfig.accentColor }}
                >
                  ₹{cartTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="px-4 py-4">
              <Button
                onClick={onPlaceOrder}
                disabled={isSubmitting}
                className="w-full h-12 text-sm font-bold rounded-2xl gap-2 shadow-lg transition-all text-white"
                style={{
                  backgroundColor: cartConfig.accentColor,
                  boxShadow: `0 4px 20px ${cartConfig.accentColor}40`,
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Placing Order…
                  </>
                ) : (
                  <>
                    <ShoppingCart size={16} />
                    Place Order
                    <ArrowRight size={14} />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
