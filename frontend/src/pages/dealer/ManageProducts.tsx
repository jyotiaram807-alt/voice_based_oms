import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Pencil, Trash2, Plus, FileUp, Upload, AlertTriangle, TrendingUp, Package,
} from "lucide-react";
import * as XLSX from "xlsx";
import { apiUrl } from "@/url";
import Sidebar from "@/components/Sidebar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Download, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttributeField {
  id: number;
  field_key: string;
  field_label: string;
  field_type: "text" | "select" | "number" | "multiselect";
  field_options: string | null;
  is_required: number;
  sort_order: number;
}

// ── ProductVariant must be kept so edit mode receives the full array ──────────
interface ProductVariant {
  id:         number;
  product_id: number;
  size:       string;
  qty:        number;
  mrp:        number;
  rate:       number;
  rack:       string;
}

interface Product {
  id:               string;
  name:             string;
  brand:            string;
  model:            string;
  color:            string;          // ← dedicated column, required for edit
  price:            number;
  stock:            number;
  description:      string;
  dealerid:         number;
  created_at?:      string;
  image?:           string | null;
  attributes?:      Record<string, string>;
  business_type_id: number | null;
  variants:         ProductVariant[]; // ← required for edit mode
}

const LOW_STOCK_THRESHOLD = 10;

// ── Component ─────────────────────────────────────────────────────────────────

const ManageProducts = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts]                             = useState<Product[]>([]);
  const [attributeSchema, setAttributeSchema]               = useState<AttributeField[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]         = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen]         = useState(false);
  const [isBulkUpdateDialogOpen, setIsBulkUpdateDialogOpen] = useState(false);
  const [currentProduct, setCurrentProduct]                 = useState<Product | null>(null);
  const [searchQuery, setSearchQuery]                       = useState("");
  const [page, setPage]                                     = useState(1);
  const [limit, setLimit]                                   = useState(10);
  const [entriesPerPage, setEntriesPerPage]                 = useState("10");
  const [sortOrder, setSortProduct]                         = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType]                         = useState<"all" | "low_stock" | "out_of_stock">("all");
  const [bulkUpdateType, setBulkUpdateType]                 = useState<"price" | "stock">("price");
  const [bulkUpdateValue, setBulkUpdateValue]               = useState("");
  const [bulkUpdateMode, setBulkUpdateMode]                 = useState<"set" | "increase" | "decrease">("set");
  const [selectedProducts, setSelectedProducts]             = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) { navigate("/"); return; }
    if (user?.role !== "dealer") navigate("/retailer/dashboard");
  }, [loading, isAuthenticated, user, navigate]);

  // ── Fetch attribute schema ──────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !isAuthenticated || user?.role !== "dealer") return;
    if (!user?.business_type_id) { setAttributeSchema([]); return; }
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res   = await fetch(
          `${apiUrl}/dealers/business-types/schema/${user.business_type_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        setAttributeSchema(Array.isArray(data) ? data : []);
      } catch { setAttributeSchema([]); }
    })();
  }, [loading, isAuthenticated, user]);

  // ── Fetch products — preserve variants[] and color ──────────────────────────
  useEffect(() => {
    if (loading || !isAuthenticated || user?.role !== "dealer" || !user?.id) return;
    (async () => {
      try {
        const token    = localStorage.getItem("token");
        const response = await fetch(`${apiUrl}/products?dealerid=${user.id}`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const data = await response.json();

        const normalizedData: Product[] = (data.products || data).map((item: any) => {
          const attrs: Record<string, string> =
            item.attributes
              ? (typeof item.attributes === "string"
                  ? JSON.parse(item.attributes)
                  : item.attributes)
              : {};

          // Resolve color: dedicated DB column first, then attributes fallback
          const color: string = item.color || attrs.color || "";

          // Normalise variants — always an array of typed objects
          const variants: ProductVariant[] = Array.isArray(item.variants)
            ? item.variants.map((v: any) => ({
                id:         Number(v.id),
                product_id: Number(v.product_id),
                size:       v.size  || "",
                qty:        Number(v.qty),
                mrp:        Number(v.mrp),
                rate:       Number(v.rate),
                rack:       v.rack  || "",
              }))
            : [];

          return {
            id:               String(item.id),
            name:             item.name,
            brand:            item.brand  || "",
            model:            item.model  || "",
            color,                           // ← preserved
            price:            parseFloat(item.price),
            stock:            Number(item.stock),
            description:      item.description || "",
            dealerid:         Number(item.dealerid),
            created_at:       item.created_at,
            image:            item.image    || null,
            attributes:       attrs,
            business_type_id: item.business_type_id ?? null,
            variants,                        // ← preserved
          };
        });

        setProducts(normalizedData);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      }
    })();
  }, [loading, isAuthenticated, user]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    totalProducts:   products.length,
    totalValue:      products.reduce((sum, p) => sum + p.price * p.stock, 0),
    lowStockCount:   products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
    outOfStockCount: products.filter((p) => p.stock === 0).length,
  }), [products]);

  // ── Navigate to edit — pass the COMPLETE product object ────────────────────
  // This is the key fix: variants[] and color are now part of the product object,
  // so AddProduct's pre-fill useEffect receives them and renders all variant rows.
  const handleEditProduct = (product: Product) => {
    navigate("/dealer/products/add", { state: { editProduct: product } });
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteProduct = (product: Product) => {
    setCurrentProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!currentProduct) return;
    try {
      const token    = localStorage.getItem("token");
      const response = await fetch(`${apiUrl}/products/${currentProduct.id}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const result = await response.json();
      if (!response.ok || (!result.success && !result.id))
        throw new Error(result.error || result.message || "Something went wrong");
      setProducts(products.filter((p) => p.id !== currentProduct.id));
      toast.success("Product deleted successfully");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("An error occurred while deleting the product.");
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  // ── Import / Export ─────────────────────────────────────────────────────────
  const handleImportClick = () => setIsImportDialogOpen(true);
  const handleFileSelect  = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data      = event.target?.result;
        const workbook  = XLSX.read(data, { type: "binary" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json      = XLSX.utils.sheet_to_json<any>(worksheet);
        if (!user?.id) { toast.error("Missing dealer ID."); return; }
        const importedProducts = json.map((row: any, index: number) => {
          if (!row.name || !row.price || row.stock === undefined)
            throw new Error(`Row ${index + 1} is missing required fields`);
          return {
            id: row.id ? String(row.id) : undefined,
            name: row.name, price: Number(row.price),
            stock: Number(row.stock), description: row.description || "",
            dealerid: Number(user.id),
          };
        });
        const response = await fetch(`${apiUrl}/products/import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: importedProducts }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "Failed to import");
        setProducts((prev) => [...prev, ...result.insertedProducts]);
        toast.success(`Imported ${result.insertedProducts.length} products`);
        setIsImportDialogOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (error: any) {
        toast.error(`Import failed: ${error.message}`);
      }
    };
    reader.onerror = () => toast.error("Failed to read the file");
    reader.readAsBinaryString(file);
  };

  const handleExport = (type: "xlsx" | "csv") => {
    const data = products.map((p) => ({
      "Product ID": p.id, Name: p.name, Brand: p.brand, Color: p.color,
      "Price (₹)": p.price.toFixed(2), Stock: p.stock,
      Description: p.description || "-",
      "Created At": p.created_at ? new Date(p.created_at).toLocaleDateString() : "-",
      ...p.attributes,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, `products.${type}`);
  };

  const downloadSampleTemplate = () => {
    const sampleRow: Record<string, string> = { name: "Sample Product", price: "999", stock: "10", description: "" };
    attributeSchema.forEach((f) => { sampleRow[f.field_key] = ""; });
    const ws = XLSX.utils.json_to_sheet([sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "product_import_template.xlsx");
  };

  // ── Selection ───────────────────────────────────────────────────────────────
  const toggleProductSelection = (productId: string) =>
    setSelectedProducts((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );

  const selectAllProducts = () => {
    if (selectedProducts.length === filteredProducts.length) setSelectedProducts([]);
    else setSelectedProducts(filteredProducts.map((p) => p.id));
  };

  // ── Bulk update ─────────────────────────────────────────────────────────────
  const handleBulkUpdate = async () => {
    if (!selectedProducts.length) { toast.error("Select products to update"); return; }
    if (!bulkUpdateValue) { toast.error("Enter a value"); return; }
    const value = parseFloat(bulkUpdateValue);
    if (isNaN(value)) { toast.error("Enter a valid number"); return; }
    try {
      const token = localStorage.getItem("token");
      await Promise.all(selectedProducts.map(async (productId) => {
        const product = products.find((p) => p.id === productId);
        if (!product) return;
        let newValue: number;
        const base = bulkUpdateType === "price" ? product.price : product.stock;
        switch (bulkUpdateMode) {
          case "set":      newValue = value; break;
          case "increase": newValue = base + value; break;
          case "decrease": newValue = Math.max(0, base - value); break;
          default:         newValue = value;
        }
        const form = new FormData();
        form.append("name",        product.name);
        form.append("price",       bulkUpdateType === "price" ? String(newValue) : String(product.price));
        form.append("stock",       bulkUpdateType === "stock" ? String(Math.floor(newValue)) : String(product.stock));
        form.append("description", product.description || "");
        form.append("dealerid",    String(user?.id));
        return fetch(`${apiUrl}/products/update/${productId}`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form,
        });
      }));
      toast.success(`Updated ${selectedProducts.length} products`);
      setIsBulkUpdateDialogOpen(false);
      setSelectedProducts([]);
      setBulkUpdateValue("");
      window.location.reload();
    } catch {
      toast.error("Failed to update products");
    }
  };

  // ── Filter / paginate ───────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          (p.color || "").toLowerCase().includes(q) ||
          Object.values(p.attributes ?? {}).some((v) => v.toLowerCase().includes(q))
      );
    }
    if (filterType === "low_stock")    filtered = filtered.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD);
    if (filterType === "out_of_stock") filtered = filtered.filter((p) => p.stock === 0);
    return filtered;
  }, [products, searchQuery, filterType]);

  const totalPages        = Math.ceil(filteredProducts.length / limit);
  const paginatedProducts = filteredProducts.slice((page - 1) * limit, page * limit);

  const formatCurrency = (value: number) => {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000)   return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toLocaleString("en-IN")}`;
  };

  // ── Render guard ────────────────────────────────────────────────────────────
  if (loading || !isAuthenticated || user?.role !== "dealer") {
    return (
      <div className="flex items-center justify-center h-screen text-lg font-semibold text-gray-600">
        Loading...
      </div>
    );
  }

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="w-64 fixed top-0 left-0 h-full z-10"><Sidebar /></div>

      <div className="flex-1 ml-64 flex flex-col">
        <Navbar />
        <div className="flex-1 overflow-y-auto pt-16">
          <div className="container mx-auto px-4 py-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Products</h1>
                <p className="text-gray-600 mt-1">Add, edit, or delete products</p>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 sm:mt-0">
                <Button onClick={handleImportClick} variant="outline" className="border-royal text-royal hover:bg-royal/10 gap-2">
                  <FileUp size={16} /> Import Excel
                </Button>
                <Button onClick={() => navigate("/dealer/products/add")} className="bg-royal hover:bg-royal-dark gap-2">
                  <Plus size={16} /> Add Product
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{stats.totalProducts}</div>
                  <p className="text-xs text-gray-500">In catalog</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Inventory Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalValue)}</div>
                  <p className="text-xs text-gray-500">Total stock value</p>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-all ${filterType === "low_stock" ? "ring-2 ring-yellow-500" : ""} ${stats.lowStockCount > 0 ? "border-yellow-400 border-2" : ""}`}
                onClick={() => setFilterType(filterType === "low_stock" ? "all" : "low_stock")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-600 flex items-center gap-2">
                    <AlertTriangle size={16} /> Low Stock Alert
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stats.lowStockCount}</div>
                  <p className="text-xs text-gray-500">Below {LOW_STOCK_THRESHOLD} units</p>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-all ${filterType === "out_of_stock" ? "ring-2 ring-red-500" : ""} ${stats.outOfStockCount > 0 ? "border-red-400 border-2" : ""}`}
                onClick={() => setFilterType(filterType === "out_of_stock" ? "all" : "out_of_stock")}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
                    <Package size={16} /> Out of Stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.outOfStockCount}</div>
                  <p className="text-xs text-gray-500">Needs restocking</p>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-1/3"
              />
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Filter" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  </SelectContent>
                </Select>
                {selectedProducts.length > 0 && (
                  <Button variant="outline" onClick={() => setIsBulkUpdateDialogOpen(true)} className="text-blue-600 border-blue-600">
                    <TrendingUp size={16} className="mr-2" />
                    Bulk Update ({selectedProducts.length})
                  </Button>
                )}
              </div>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <div className="p-4 border-b flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Show</span>
                    <Select
                      value={entriesPerPage}
                      onValueChange={(value) => {
                        setEntriesPerPage(value);
                        setPage(1);
                        if (value === "all") setLimit(filteredProducts.length);
                        else setLimit(Number(value));
                      }}
                    >
                      <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
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
                    <Button variant="outline" size="sm" onClick={() => setSortProduct(sortOrder === "asc" ? "desc" : "asc")}>
                      <ArrowUpDown className="w-4 h-4 mr-1" /> Sort {sortOrder === "asc" ? "↑" : "↓"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
                      <Download className="w-4 h-4 mr-1" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")}>
                      <Download className="w-4 h-4 mr-1" /> Excel
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                          onChange={selectAllProducts}
                          className="rounded"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      {attributeSchema.slice(0, 3).map((f) => (
                        <TableHead key={f.field_key}>{f.field_label}</TableHead>
                      ))}
                      <TableHead>Color</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.length > 0 ? (
                      paginatedProducts.map((product) => (
                        <TableRow
                          key={product.id}
                          className={
                            product.stock === 0 ? "bg-red-50"
                            : product.stock <= LOW_STOCK_THRESHOLD ? "bg-yellow-50" : ""
                          }
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => toggleProductSelection(product.id)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          {attributeSchema.slice(0, 3).map((f) => {
                            let val = product.attributes?.[f.field_key] || "";
                            if (!val && f.field_key === "brand") val = product.brand || "";
                            if (!val && f.field_key === "model") val = product.model || "";
                            return <TableCell key={f.field_key}>{val || "—"}</TableCell>;
                          })}
                          {/* Color column */}
                          <TableCell>
                            {product.color
                              ? <Badge className="bg-pink-50 text-pink-700 border-pink-200 text-xs">{product.color}</Badge>
                              : <span className="text-gray-400">—</span>
                            }
                          </TableCell>
                          <TableCell>₹{product.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{product.stock}</span>
                              {product.stock === 0 && <Badge variant="destructive" className="text-xs">Out</Badge>}
                              {product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD && <Badge className="bg-yellow-500 text-xs">Low</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditProduct(product)}
                              >
                                <Pencil size={16} />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteProduct(product)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6 + Math.min(attributeSchema.length, 3)} className="text-center py-8">
                          <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500">No products found</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="p-4 border-t flex justify-between items-center text-sm text-gray-600 flex-wrap gap-2">
                  <div>
                    Showing {filteredProducts.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
                    {Math.min(page * limit, filteredProducts.length)} of {filteredProducts.length} entries
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>
                    <span className="font-semibold">{page} / {totalPages || 1}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleFileChange} />

            {/* Import Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileUp className="h-4 w-4 text-blue-600" />
                    </div>
                    Import Products from Excel
                  </DialogTitle>
                </DialogHeader>
                <div className="py-6 flex flex-col items-center gap-4">
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center w-full cursor-pointer hover:border-royal transition-colors"
                    onClick={handleFileSelect}
                  >
                    <Upload size={36} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-1">Click to select an Excel file</p>
                    <p className="text-xs text-gray-400">Supports .xlsx and .xls formats</p>
                  </div>
                  <Button variant="outline" onClick={downloadSampleTemplate}>
                    <FileUp size={18} className="mr-2" /> Download Sample Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Bulk Update Dialog */}
            <Dialog open={isBulkUpdateDialogOpen} onOpenChange={setIsBulkUpdateDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                    </div>
                    Bulk Update Products
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <p className="text-sm text-gray-600">Update <span className="font-semibold">{selectedProducts.length}</span> selected product(s)</p>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Update Type</Label>
                    <Select value={bulkUpdateType} onValueChange={(v) => setBulkUpdateType(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price">Price</SelectItem>
                        <SelectItem value="stock">Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Update Mode</Label>
                    <Select value={bulkUpdateMode} onValueChange={(v) => setBulkUpdateMode(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="set">Set to value</SelectItem>
                        <SelectItem value="increase">Increase by</SelectItem>
                        <SelectItem value="decrease">Decrease by</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Value</Label>
                    <Input
                      type="number"
                      placeholder={bulkUpdateType === "price" ? "Enter price" : "Enter quantity"}
                      value={bulkUpdateValue}
                      onChange={(e) => setBulkUpdateValue(e.target.value)}
                      min="0"
                      step={bulkUpdateType === "price" ? "0.01" : "1"}
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsBulkUpdateDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleBulkUpdate} className="bg-royal hover:bg-royal-dark">Update Products</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-600">
                    <div className="h-7 w-7 rounded-lg bg-red-100 flex items-center justify-center">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </div>
                    Delete Product
                  </DialogTitle>
                </DialogHeader>
                <div className="py-3">
                  <p className="text-sm text-gray-700">
                    Are you sure you want to delete{" "}
                    <span className="font-semibold text-gray-900">{currentProduct?.name}</span>?
                  </p>
                  <p className="text-xs text-gray-400 mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    This action cannot be undone.
                  </p>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                  <Button onClick={confirmDeleteProduct} className="bg-red-500 hover:bg-red-600 text-white">Delete</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageProducts;
