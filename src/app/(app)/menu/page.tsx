"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal-sheet";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Plus,
  Edit2,
  Trash2,
  ListRestart,
  AlertTriangle,
  Loader2,
  CheckCircle,
  RefreshCw,
  Sparkles,
  Search,
  BookOpen,
  Scale,
  DollarSign,
  Layers,
  ChevronRight,
  UploadCloud,
  FileImage
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────────────────────── TYPES ───────────────────────────── */

interface MenuCategory {
  id: string;
  name: string;
  isKitchen: boolean;
}

interface RawItem {
  id: string;
  name: string;
  unit: string;
  costPrice: string;
}

interface RecipeLinePayload {
  id?: string;
  rawItemId: string;
  qtyPerUnit: number;
}

interface RecipePayload {
  id: string;
  lines: Array<{
    id: string;
    rawItemId: string;
    qtyPerUnit: number;
    rawItem?: RawItem;
  }>;
}

interface MenuItem {
  id: string;
  name: string;
  price: string;
  categoryId: string;
  category: MenuCategory;
  recipe?: RecipePayload | null;
  imageUrl?: string | null;
}

interface MenuData {
  categories: MenuCategory[];
  menuItems: any[];
}

interface RecipeDetailsResponse {
  recipe: RecipePayload | null;
  costPerUnit: number;
}

/* ═══════════════════════════ COMPONENT ══════════════════════════ */

export default function MenuConfigPage() {
  const { role: currentUserRole, loading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = currentUserRole === "ADMIN" || currentUserRole === "SUPER_ADMIN";

  // Modals visibility states
  const [manageOpen, setManageOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Selected item states
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("ALL");

  // Product Form states
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [categoryId, setCategoryId] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Category Form states
  const [newCatName, setNewCatName] = useState("");
  const [newCatIsKitchen, setNewCatIsKitchen] = useState(true);

  // Recipe Composer states
  const [recipeLines, setRecipeLines] = useState<RecipeLinePayload[]>([]);
  const [recipeCost, setRecipeCost] = useState<number>(0);

  // Image Uploading operational states
  const [isUploading, setIsUploading] = useState(false);

  // Operational feedback banners
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  /* ── 1. DATA QUERIES ────────────────────────────────────────────── */

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Query 1: Fetch all menu items + categories + recipe line ids
  const { data: paginatedData, isLoading: isItemsLoading, refetch: refetchItems } = useQuery<{ data: MenuItem[]; pagination: any }>({
    queryKey: ["menu-items", page, limit, searchQuery, selectedCatId],
    queryFn: async () => {
      const res = await fetch(`/api/menu-items?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&categoryId=${selectedCatId}`);
      if (!res.ok) throw new Error("Failed to load menu items");
      return res.json();
    },
    enabled: isAdmin
  });
  const menuItems = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

  // Query 2: Fetch POS categories for selects
  const { data: posData } = useQuery<MenuData>({
    queryKey: ["pos-menu"],
    queryFn: async () => {
      const res = await fetch("/api/pos/menu");
      if (!res.ok) throw new Error("Failed to load POS menu items");
      return res.json();
    },
    enabled: isAdmin
  });

  // Query 3: Fetch Raw Items list for recipe composer dropdowns
  const { data: rawItems = [] } = useQuery<RawItem[]>({
    queryKey: ["inventory-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/inventory?limit=1000");
      if (!res.ok) throw new Error("Failed to load raw items list");
      const json = await res.json();
      return json.data || [];
    },
    enabled: recipeOpen && isAdmin
  });

  // Query 4: Fetch detailed recipe ingredients for selected item
  const { data: activeRecipeDetails, isLoading: isRecipeLoading, refetch: refetchActiveRecipe } = useQuery<RecipeDetailsResponse>({
    queryKey: ["recipe-detail", selectedItem?.id],
    queryFn: async () => {
      const res = await fetch(`/api/menu-items/${selectedItem?.id}/recipe`);
      if (!res.ok) throw new Error("Failed to retrieve recipe formula");
      return res.json();
    },
    enabled: !!selectedItem?.id && recipeOpen && isAdmin
  });

  // Keep local recipe lines state synced with query responses
  useEffect(() => {
    if (activeRecipeDetails?.recipe) {
      setRecipeLines(
        activeRecipeDetails.recipe.lines.map((l) => ({
          rawItemId: l.rawItemId,
          qtyPerUnit: Number(l.qtyPerUnit)
        }))
      );
      setRecipeCost(activeRecipeDetails.costPerUnit || 0);
    } else {
      setRecipeLines([]);
      setRecipeCost(0);
    }
  }, [activeRecipeDetails]);

  // Recalculate local recipe costs in real-time as ingredients edit
  useEffect(() => {
    if (!recipeLines.length || !rawItems.length) {
      setRecipeCost(0);
      return;
    }
    const sum = recipeLines.reduce((acc, line) => {
      const matched = rawItems.find((r) => r.id === line.rawItemId);
      const unitCost = matched ? parseFloat(matched.costPrice) : 0;
      return acc + line.qtyPerUnit * unitCost;
    }, 0);
    setRecipeCost(sum);
  }, [recipeLines, rawItems]);

  /* ── 2. DATA MUTATIONS ──────────────────────────────────────────── */

  // Mutation: Create product
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create menu item.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setManageOpen(false);
      setName("");
      setPrice(0);
      setCategoryId("");
      setImageUrl("");
      setApiError(null);
      setSuccessMsg(`Product '${data.name}' created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      queryClient.invalidateQueries({ queryKey: ["pos-menu"] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  // Mutation: Edit product details
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/menu-items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update menu item.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setManageOpen(false);
      setName("");
      setPrice(0);
      setCategoryId("");
      setImageUrl("");
      setSelectedItem(null);
      setApiError(null);
      setSuccessMsg(`Product '${data.name}' updated successfully!`);
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      queryClient.invalidateQueries({ queryKey: ["pos-menu"] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  // Mutation: Update Recipe formulas
  const updateRecipeMutation = useMutation({
    mutationFn: async ({ id, lines }: { id: string; lines: RecipeLinePayload[] }) => {
      const res = await fetch(`/api/menu-items/${id}/recipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save recipe formula.");
      }
      return res.json();
    },
    onSuccess: () => {
      setRecipeOpen(false);
      setRecipeLines([]);
      setSelectedItem(null);
      setApiError(null);
      setSuccessMsg("Recipe formula updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  // Mutation: Delete product
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/menu-items/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete product.");
      }
      return res.json();
    },
    onSuccess: () => {
      setDeleteOpen(false);
      setSelectedItem(null);
      setApiError(null);
      setSuccessMsg("Menu product deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      queryClient.invalidateQueries({ queryKey: ["pos-menu"] });
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  // Mutation: Create Category
  const createCategoryMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/menu-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create category.");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewCatName("");
      setApiError(null);
      queryClient.invalidateQueries({ queryKey: ["pos-menu"] });
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  // Mutation: Delete Category
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/menu-categories/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete category.");
      }
      return res.json();
    },
    onSuccess: () => {
      setApiError(null);
      queryClient.invalidateQueries({ queryKey: ["pos-menu"] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  /* ── 3. ACCESS GATING CONTROL ───────────────────────────────────── */

  if (isAuthLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-fade-in-up">
        <div className="h-14 w-14 rounded-full bg-danger/10 text-danger flex items-center justify-center shadow-xs">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="font-extrabold text-lg text-ink">Access Restricted</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Only users with <span className="font-black text-danger">Admin</span> or <span className="font-black text-danger">Super Admin</span> roles are permitted to modify menu recipes.
          </p>
        </div>
      </div>
    );
  }

  /* ── 4. RECIPE LIST ACTIONS ─────────────────────────────────────── */

  const handleAddRecipeLine = () => {
    if (rawItems.length > 0) {
      setRecipeLines([...recipeLines, { rawItemId: rawItems[0].id, qtyPerUnit: 0.1 }]);
    }
  };

  const handleRemoveRecipeLine = (idx: number) => {
    setRecipeLines(recipeLines.filter((_, i) => i !== idx));
  };

  const handleUpdateRecipeLine = (idx: number, field: keyof RecipeLinePayload, val: any) => {
    setRecipeLines(
      recipeLines.map((line, i) => {
        if (i === idx) {
          return { ...line, [field]: val };
        }
        return line;
      })
    );
  };

  /* ── 5. GRID FILTERS & COLUMNS ──────────────────────────────────── */

  const filteredItems = menuItems;

  const columns = [
    {
      key: "name",
      label: "Product Name",
      render: (val: string, row: MenuItem) => (
        <div className="flex items-center gap-2.5">
          {row.imageUrl ? (
            <div className="h-7 w-7 rounded-control border border-border overflow-hidden shrink-0 select-none bg-surface-sunken">
              <img src={row.imageUrl} className="h-full w-full object-cover" alt="" />
            </div>
          ) : (
            <div className="h-7 w-7 rounded-control bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px] shrink-0 select-none">
              {val.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-extrabold text-ink block leading-tight">{val}</span>
            <span className="text-[9px] text-ink-muted/60 font-bold uppercase tracking-wider block">
              {row.category.name}
            </span>
          </div>
        </div>
      )
    },
    {
      key: "category",
      label: "Preparation Sector",
      render: (_: any, row: MenuItem) => (
        <StatusBadge
          status={row.category.isKitchen ? "KITCHEN" : "BAR/STARTERS"}
          className="text-[9px] font-extrabold tracking-wider"
        />
      )
    },
    {
      key: "price",
      label: "Customer Price",
      render: (val: string) => (
        <span className="font-bold text-ink font-mono tabular-nums">
          Rs. {parseFloat(val).toFixed(2)}
        </span>
      )
    },
    {
      key: "recipe",
      label: "Ingredient Cost",
      render: (_: any, row: MenuItem) => {
        const hasRecipe = !!row.recipe;
        return (
          <span className="font-bold text-ink-muted font-mono tabular-nums">
            {hasRecipe ? "Calculated" : "No Recipe Setup"}
          </span>
        );
      }
    },
    {
      key: "actions",
      label: "Administrative Actions",
      render: (_: any, row: MenuItem) => (
        <div className="flex items-center gap-3 select-none">
          <button
            onClick={() => {
              setSelectedItem(row);
              setName(row.name);
              setPrice(parseFloat(row.price));
              setCategoryId(row.categoryId);
              setImageUrl(row.imageUrl || "");
              setManageOpen(true);
            }}
            className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover font-bold"
            title="Edit product details"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => {
              setSelectedItem(row);
              setRecipeOpen(true);
            }}
            className="flex items-center gap-1 text-[11px] text-info hover:text-info-hover font-bold"
            title="Edit recipe raw ingredients"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Recipe</span>
          </button>

          <button
            onClick={() => {
              setSelectedItem(row);
              setDeleteOpen(true);
            }}
            className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-danger font-bold"
            title="Delete product"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <PageHeader
        title="Menu & Recipes Config"
        description="Add operational products, configure custom menu items, modify base prices, and compose raw material recipes."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setApiError(null);
                setNewCatName("");
                setCategoriesOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-sunken hover:bg-border border border-border text-ink hover:text-ink-hover text-xs font-bold rounded-control transition-all select-none shadow-xs"
            >
              <Layers className="h-4 w-4" />
              <span>Manage Categories</span>
            </button>
            <button
              onClick={() => {
                setSelectedItem(null);
                setName("");
                setPrice(0);
                setCategoryId(posData?.categories[0]?.id || "");
                setImageUrl("");
                setManageOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover transition-all duration-200 select-none shadow-xs active:scale-[0.98] animate-pulse-glow"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          </div>
        }
      />

      {/* FEEDBACK STATUS BANNERS */}
      {successMsg && (
        <div className="rounded-control border border-success/30 bg-success/10 p-4 text-xs text-success flex items-center gap-2.5 animate-fade-in-up">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {apiError && (
        <div className="rounded-control border border-danger/30 bg-danger/10 p-4 text-xs text-danger flex items-center gap-2.5 animate-fade-in-up">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* FILTERS & SEARCH MODULE */}
      <div className="rounded-card border border-border bg-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs animate-fade-in-up [animation-delay:50ms]">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search products name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-control border border-border bg-surface-sunken/45 pl-9 pr-4 py-1.5 text-xs text-ink placeholder-ink-muted/70 outline-none focus:border-primary focus:bg-card transition-all"
            />
          </div>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="rounded-control border border-border bg-card text-ink font-semibold px-2 py-1.5 text-xs outline-none focus:border-primary cursor-pointer select-none shadow-xs"
          >
            <option value={10}>10 Show</option>
            <option value={15}>15 Show</option>
            <option value={25}>25 Show</option>
          </select>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto max-w-full pb-1 select-none scrollbar-none">
          <button
            onClick={() => {
              setSelectedCatId("ALL");
              setPage(1);
            }}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase whitespace-nowrap transition-colors",
              selectedCatId === "ALL"
                ? "bg-primary text-white"
                : "bg-surface-sunken text-ink-muted hover:bg-border"
            )}
          >
            All
          </button>
          {posData?.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCatId(cat.id);
                setPage(1);
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase whitespace-nowrap transition-colors",
                selectedCatId === cat.id
                  ? "bg-primary text-white"
                  : "bg-surface-sunken text-ink-muted hover:bg-border"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* DIRECTORY TABLE */}
      {isItemsLoading ? (
        <div className="flex h-[35vh] items-center justify-center text-primary">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in-up [animation-delay:100ms]">
          <div className="bg-card border border-border rounded-card p-1.5 shadow-sm overflow-hidden">
            <DataTable columns={columns} data={filteredItems} />
          </div>
          {pagination && (
            <PaginationControls
              currentPage={page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              limit={limit}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </div>
      )}

      {/* MODAL 1: ADD/EDIT MENU ITEM */}
      <Modal
        isOpen={manageOpen}
        onClose={() => {
          setManageOpen(false);
          setApiError(null);
          setSelectedItem(null);
        }}
        title={selectedItem ? `Modify Product — ${selectedItem?.name}` : "Add Menu Product"}
        footer={
          <>
            <button
              onClick={() => setManageOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!name || !price || !categoryId) {
                  setApiError("All product fields are required.");
                  return;
                }
                const payload = { name, price: Number(price), categoryId, imageUrl: imageUrl || null };
                if (selectedItem) {
                  updateMutation.mutate({ id: selectedItem.id, payload });
                } else {
                  createMutation.mutate(payload);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending || isUploading}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              <span>Save Product</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {apiError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {apiError}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Menu Item Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Buff Sekuwa (Plate)"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                Retail Price (NPR)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price || ""}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                placeholder="Rs. 0.00"
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                Category Group
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none bg-card focus:border-primary"
              >
                <option value="">-- Choose Category --</option>
                {posData?.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product image upload section */}
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Product Dish Image
            </label>
            <div className="flex items-center gap-3 bg-surface-sunken/45 border border-border rounded-control p-3">
              {imageUrl ? (
                <div className="h-14 w-14 rounded-control overflow-hidden border border-border shrink-0 bg-surface-sunken relative group">
                  <img src={imageUrl} className="h-full w-full object-cover" alt="Preview" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute inset-0 bg-black/70 text-white text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center select-none"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="h-14 w-14 rounded-control border border-dashed border-border shrink-0 flex items-center justify-center text-ink-muted bg-surface-sunken">
                  <FileImage className="h-5 w-5 opacity-40" />
                </div>
              )}
              
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append("file", file);

                    try {
                      setIsUploading(true);
                      setApiError(null);
                      const res = await fetch("/api/upload", {
                        method: "POST",
                        body: formData
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || "Upload failed");
                      }
                      const data = await res.json();
                      setImageUrl(data.url);
                    } catch (err: any) {
                      setApiError(err.message || "Failed to upload image.");
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                  className="block w-full text-xs text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:text-xs file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
                />
                <span className="text-[9px] text-ink-muted/60 mt-1 block leading-normal">
                  PNG, JPG, or WebP (Max 4MB). Saves locally on server.
                </span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: RECIPE COMPOSER */}
      <Modal
        isOpen={recipeOpen}
        onClose={() => {
          setRecipeOpen(false);
          setRecipeLines([]);
          setApiError(null);
          setSelectedItem(null);
        }}
        title={`Recipe Formulation — ${selectedItem?.name}`}
        className="max-w-3xl h-[80vh]"
        footer={
          <>
            <button
              onClick={() => setRecipeOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedItem) {
                  updateRecipeMutation.mutate({ id: selectedItem.id, lines: recipeLines });
                }
              }}
              disabled={updateRecipeMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {updateRecipeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Formula</span>
            </button>
          </>
        }
      >
        {isRecipeLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 h-full max-h-[58vh]">
            
            {/* Left side: Ingredients list editor */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <h4 className="font-extrabold text-xs text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Recipe Ingredients ({recipeLines.length})</span>
                </h4>
                <button
                  onClick={handleAddRecipeLine}
                  className="px-2.5 py-1 bg-surface-sunken hover:bg-border border border-border text-[10px] font-extrabold uppercase rounded-control transition-colors"
                >
                  + Add Ingredient
                </button>
              </div>

              {recipeLines.length > 0 ? (
                <div className="space-y-3.5">
                  {recipeLines.map((line, idx) => {
                    const matchedRaw = rawItems.find((r) => r.id === line.rawItemId);
                    const unit = matchedRaw?.unit || "UNIT";
                    const costPrice = matchedRaw ? parseFloat(matchedRaw.costPrice) : 0;

                    return (
                      <div
                        key={idx}
                        className="rounded-control border border-border p-3 bg-surface-sunken/30 flex items-center justify-between gap-3 animate-fade-in-up"
                      >
                        {/* Ingredient select */}
                        <div className="flex-1">
                          <select
                            value={line.rawItemId}
                            onChange={(e) => handleUpdateRecipeLine(idx, "rawItemId", e.target.value)}
                            className="w-full rounded-control border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary shadow-xs"
                          >
                            {rawItems.map((raw) => (
                              <option key={raw.id} value={raw.id}>
                                {raw.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity input */}
                        <div className="w-24 flex items-center gap-1">
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={line.qtyPerUnit || ""}
                            onChange={(e) =>
                              handleUpdateRecipeLine(idx, "qtyPerUnit", parseFloat(e.target.value) || 0)
                            }
                            className="w-full rounded-control border border-border px-2 py-1 text-xs font-mono text-right text-ink outline-none focus:border-primary shadow-xs"
                          />
                          <span className="text-[10px] font-bold text-ink-muted/80">{unit}</span>
                        </div>

                        {/* Calculated cost snippet */}
                        <div className="w-24 text-right pr-2">
                          <span className="text-[10px] text-ink-muted/50 font-bold block">Cost Unit</span>
                          <span className="text-xs font-bold text-ink font-mono tabular-nums">
                            Rs. {(line.qtyPerUnit * costPrice).toFixed(0)}
                          </span>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => handleRemoveRecipeLine(idx)}
                          className="text-ink-muted/40 hover:text-danger p-1 rounded-control transition-colors"
                          title="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 border border-dashed border-border rounded-card bg-surface-sunken/10 text-ink-muted text-xs italic">
                  No ingredients added yet. Click "+ Add Ingredient" to compile raw stocks mapping.
                </div>
              )}
            </div>

            {/* Right side: Real-time costing margins sidebar summary */}
            {selectedItem && (
              <div className="w-full md:w-[240px] border border-border bg-surface-sunken/40 rounded-card p-4 flex flex-col justify-between shrink-0">
                <div className="space-y-4">
                  <h4 className="font-extrabold text-xs text-ink border-b border-border pb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="h-4.5 w-4.5 text-primary" />
                    <span>Costing Summary</span>
                  </h4>

                  <div className="space-y-3 text-xs select-none">
                    <div className="flex justify-between text-ink-muted">
                      <span>Customer Price:</span>
                      <span className="font-bold text-ink font-mono">Rs. {parseFloat(selectedItem!.price).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between text-ink-muted">
                      <span>Ingredient Cost:</span>
                      <span className="font-bold text-ink font-mono">Rs. {recipeCost.toFixed(2)}</span>
                    </div>

                    <div className="border-t border-border/50 pt-2.5 flex justify-between font-bold text-ink">
                      <span>Profit Margin:</span>
                      <span className={cn(
                        "font-mono tabular-nums",
                        parseFloat(selectedItem!.price) - recipeCost > 0 ? "text-success" : "text-danger"
                      )}>
                        Rs. {(parseFloat(selectedItem!.price) - recipeCost).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between font-bold text-ink-muted text-[10px]">
                      <span>Margin Percent:</span>
                      <span className="font-mono tabular-nums">
                        {parseFloat(selectedItem!.price) > 0
                          ? `${(((parseFloat(selectedItem!.price) - recipeCost) / parseFloat(selectedItem!.price)) * 100).toFixed(0)}%`
                          : "0%"}
                      </span>
                    </div>
                  </div>
                </div>

                {apiError && (
                  <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-[10px] text-danger mt-4 leading-normal">
                    {apiError}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </Modal>

      {/* MODAL 3: DELETE PRODUCT SAFEGUARD */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setApiError(null);
          setSelectedItem(null);
        }}
        title="Confirm Product Deletion"
        footer={
          <>
            <button
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedItem) {
                  deleteMutation.mutate(selectedItem.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-xs font-bold rounded-control shadow-sm hover:bg-danger-hover disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Delete Permanently</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-control bg-danger/10 border border-danger/25 p-3.5 text-xs text-danger flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold block">Relational Constraint Check</span>
              <p className="text-[11px] leading-relaxed">
                Are you sure you want to delete <span className="font-black underline">{selectedItem?.name}</span>? 
                This deletes the menu product details and its linked raw ingredients recipes. If this product is linked to past sales transactions, Postgres will reject the deletion to preserve audit trails.
              </p>
            </div>
          </div>

          {apiError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger animate-fade-in-up">
              {apiError}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 4: CATEGORY MANAGEMENT */}
      <Modal
        isOpen={categoriesOpen}
        onClose={() => {
          setCategoriesOpen(false);
          setApiError(null);
        }}
        title="Manage Product Categories"
        className="max-w-2xl"
        footer={
          <button
            onClick={() => setCategoriesOpen(false)}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-control hover:bg-primary-hover transition-colors"
          >
            Done
          </button>
        }
      >
        <div className="space-y-6">
          {apiError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {apiError}
            </div>
          )}

          {/* Add Category Form */}
          <div className="rounded-card border border-border p-4 bg-surface-sunken/30 space-y-3.5">
            <h4 className="font-extrabold text-xs text-ink uppercase tracking-wider">
              Add New Category
            </h4>
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full">
                <label className="block text-[9px] font-bold text-ink-muted uppercase mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chef Specials"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full rounded-control border border-border px-3 py-1.5 text-xs text-ink outline-none bg-card focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 mb-2 select-none">
                <input
                  type="checkbox"
                  id="catIsKitchen"
                  checked={newCatIsKitchen}
                  onChange={(e) => setNewCatIsKitchen(e.target.checked)}
                  className="h-4 w-4 rounded-control border border-border text-primary focus:ring-primary/20 accent-primary"
                />
                <label htmlFor="catIsKitchen" className="text-xs font-bold text-ink-muted cursor-pointer">
                  Kitchen Sector (Food)
                </label>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!newCatName) {
                    setApiError("Category name is required.");
                    return;
                  }
                  createCategoryMutation.mutate({ name: newCatName, isKitchen: newCatIsKitchen });
                }}
                disabled={createCategoryMutation.isPending}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-control hover:bg-primary-hover disabled:opacity-50 transition-colors shrink-0"
              >
                Create
              </button>
            </div>
          </div>

          {/* Categories list directory */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-xs text-ink uppercase tracking-wider">
              Existing Categories
            </h4>
            
            <div className="max-h-[30vh] overflow-y-auto border border-border rounded-card bg-card divide-y divide-border/60">
              {posData?.categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 text-xs hover:bg-surface-sunken/40">
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-ink">{cat.name}</span>
                    <StatusBadge
                      status={cat.isKitchen ? "KITCHEN" : "BAR/STARTERS"}
                      className="text-[8px] font-black tracking-wider"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete category "${cat.name}"? This will delete all products in this category.`)) {
                        deleteCategoryMutation.mutate(cat.id);
                      }
                    }}
                    disabled={deleteCategoryMutation.isPending}
                    className="text-ink-muted/50 hover:text-danger p-1 transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </Modal>
    </div>
  );
}
