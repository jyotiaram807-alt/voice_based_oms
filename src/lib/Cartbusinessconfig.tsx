// src/lib/cartBusinessConfig.ts
// Configuration-driven cart rendering per business type

export interface CartFieldConfig {
  key: string;
  label: string;
  show: boolean;
  priority: number; // lower = shown first
  renderAs?: "badge" | "text" | "color-swatch" | "tag";
  colorSwatch?: boolean;
}

export interface CartVariantConfig {
  primaryLabel: string;       // e.g. "Size" for garments, "Storage" for mobiles
  secondaryLabel?: string;    // e.g. "Color" for garments, "RAM" for mobiles
  showRack: boolean;
  showMrp: boolean;
  unitLabel: string;          // "pcs" for garments, "units" for mobiles
}

export interface BusinessCartConfig {
  businessTypeId: number | null;
  name: string;
  accentColor: string;
  productFields: CartFieldConfig[];   // fields to show in product header
  variantConfig: CartVariantConfig;
  emptyCartMessage: string;
}

// Default fallback config
const defaultConfig: BusinessCartConfig = {
  businessTypeId: null,
  name: "General",
  accentColor: "#3b82f6",
  productFields: [
    { key: "brand", label: "Brand", show: true, priority: 1, renderAs: "badge" },
    { key: "color", label: "Color", show: true, priority: 2, renderAs: "color-swatch" },
  ],
  variantConfig: {
    primaryLabel: "Variant",
    showRack: true,
    showMrp: true,
    unitLabel: "units",
  },
  emptyCartMessage: "Add products to get started",
};

// Garments / Apparel business type
const garmentsConfig: BusinessCartConfig = {
  businessTypeId: 1,
  name: "Garments",
  accentColor: "#8b5cf6",
  productFields: [
    { key: "brand", label: "Brand", show: true, priority: 1, renderAs: "badge" },
    { key: "color", label: "Color", show: true, priority: 2, renderAs: "color-swatch" },
    { key: "fabric_type", label: "Fabric", show: true, priority: 3, renderAs: "tag" },
    { key: "category", label: "Category", show: true, priority: 4, renderAs: "tag" },
    { key: "master_category", label: "Category", show: true, priority: 4, renderAs: "tag" },
    { key: "design", label: "Design", show: true, priority: 5, renderAs: "text" },
    { key: "hsn_code", label: "HSN", show: false, priority: 6, renderAs: "text" },
  ],
  variantConfig: {
    primaryLabel: "Size",
    secondaryLabel: "Color",
    showRack: true,
    showMrp: true,
    unitLabel: "pcs",
  },
  emptyCartMessage: "Add garments to your order",
};

// Mobile / Electronics business type
const mobilesConfig: BusinessCartConfig = {
  businessTypeId: 2,
  name: "Mobiles",
  accentColor: "#0ea5e9",
  productFields: [
    { key: "brand", label: "Brand", show: true, priority: 1, renderAs: "badge" },
    { key: "model", label: "Model", show: true, priority: 2, renderAs: "text" },
    { key: "color", label: "Color", show: true, priority: 3, renderAs: "color-swatch" },
    { key: "ram", label: "RAM", show: true, priority: 4, renderAs: "tag" },
    { key: "storage", label: "Storage", show: true, priority: 5, renderAs: "tag" },
    { key: "category", label: "Category", show: false, priority: 6, renderAs: "tag" },
  ],
  variantConfig: {
    primaryLabel: "Storage",
    secondaryLabel: "RAM",
    showRack: true,
    showMrp: true,
    unitLabel: "units",
  },
  emptyCartMessage: "Add mobile devices to your order",
};

// Registry — add new business types here
const businessConfigRegistry: BusinessCartConfig[] = [
  garmentsConfig,
  mobilesConfig,
];

/**
 * Get the cart configuration for a given business type ID.
 * Falls back to default if no match.
 */
export function getCartConfig(businessTypeId: number | null | undefined): BusinessCartConfig {
  if (!businessTypeId) return defaultConfig;
  return (
    businessConfigRegistry.find((c) => c.businessTypeId === businessTypeId) ?? defaultConfig
  );
}

/**
 * Get visible product fields for a business type, sorted by priority.
 */
export function getVisibleFields(
  config: BusinessCartConfig,
  attributes: Record<string, string>,
  brand?: string,
  color?: string,
): Array<{ label: string; value: string; renderAs: CartFieldConfig["renderAs"] }> {
  const result: Array<{ label: string; value: string; renderAs: CartFieldConfig["renderAs"] }> = [];

  const sorted = [...config.productFields]
    .filter((f) => f.show)
    .sort((a, b) => a.priority - b.priority);

  for (const field of sorted) {
    let value = "";
    if (field.key === "brand") value = brand || attributes?.brand || "";
    else if (field.key === "color") value = color || attributes?.color || "";
    else value = attributes?.[field.key] || "";

    if (value) {
      result.push({ label: field.label, value, renderAs: field.renderAs });
    }
  }

  return result;
}
