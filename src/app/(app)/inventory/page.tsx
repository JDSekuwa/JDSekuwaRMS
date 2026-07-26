"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, TableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal-sheet";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { 
  Scale, 
  FileText, 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  RotateCcw, 
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
  costPrice: number | null;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: {
    name: string;
  };
}

interface RecipeLine {
  id: string;
  rawItemId: string;
  qtyPerUnit: number;
  rawItem: {
    id: string;
    name: string;
    unit: string;
    costPrice: number | null;
  };
}

interface RecipeData {
  recipe: {
    id: string;
    menuItemId: string;
    lines: RecipeLine[];
  } | null;
  costPerUnit: number | null;
}

export default function InventoryPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  // Selected item states for Adjust Modal
  const [selectedRawItem, setSelectedRawItem] = useState<InventoryItem | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustCostPrice, setAdjustCostPrice] = useState("");
  const [adjustReason, setAdjustReason] = useState("Restock");
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Edit Raw Item states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("KG");
  const [editMinThreshold, setEditMinThreshold] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Raw Item states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Smart Reorder states
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [reorderItem, setReorderItem] = useState<InventoryItem | null>(null);
  const [reorderQty, setReorderQty] = useState("");
  const [reorderUnitCost, setReorderUnitCost] = useState("");
  const [reorderSupplierName, setReorderSupplierName] = useState("");
  const [reorderError, setReorderError] = useState<string | null>(null);

  // Recipe Builder states
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [selectedMenuId, setSelectedMenuId] = useState<string>("");
  const [recipeLines, setRecipeLines] = useState<Array<{ rawItemId: string; qtyPerUnit: number }>>([]);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  // Add Raw Item states
  const [addRawModalOpen, setAddRawModalOpen] = useState(false);
  const [addRawName, setAddRawName] = useState("");
  const [addRawUnit, setAddRawUnit] = useState("KG");
  const [addRawMinThreshold, setAddRawMinThreshold] = useState("");
  const [addRawCostPrice, setAddRawCostPrice] = useState("");
  const [addRawCurrentStock, setAddRawCurrentStock] = useState("");
  const [addRawError, setAddRawError] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Query raw items list
  const { data: paginatedData, isLoading: isInvLoading } = useQuery<{ data: InventoryItem[]; pagination: any }>({
    queryKey: ["inventory", page, limit, searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/inventory?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to load inventory");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });
  const inventory = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

  // 1.5. Query all raw items for Recipe Builder (bypass pagination, up to 1000 items)
  const { data: allRawItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["all-raw-items"],
    queryFn: async () => {
      const res = await fetch("/api/inventory?page=1&limit=1000");
      if (!res.ok) throw new Error("Failed to load all inventory items");
      const result = await res.json();
      return result.data || [];
    },
    enabled: (recipeModalOpen || editModalOpen) && isAdmin
  });

  // Query last purchase snapshot for Smart Reorder
  const { data: lastPurchaseData, isLoading: isLastPurchaseLoading } = useQuery<{
    qty: number;
    unitCost: number;
    supplierName: string | null;
    purchasedAt: string;
    notFound?: boolean;
  }>({
    queryKey: ["last-purchase", reorderItem?.id],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/${reorderItem?.id}/last-purchase`);
      if (!res.ok) throw new Error("Failed to load last purchase details");
      return res.json();
    },
    enabled: !!reorderItem?.id && reorderModalOpen && isAdmin,
  });

  // Pre-fill Reorder fields when lastPurchaseData loads
  useEffect(() => {
    if (lastPurchaseData && !lastPurchaseData.notFound) {
      setReorderQty(String(lastPurchaseData.qty));
      setReorderUnitCost(String(lastPurchaseData.unitCost));
      setReorderSupplierName(lastPurchaseData.supplierName || "");
    }
  }, [lastPurchaseData]);

  // 2. Query menu items list (only for Admin/SuperAdmin for recipe building)
  const { data: menuItems = [] } = useQuery<MenuItem[]>({
    queryKey: ["menu-items"],
    queryFn: async () => {
      const res = await fetch("/api/menu-items");
      if (!res.ok) throw new Error("Failed to load menu items");
      return res.json();
    },
    enabled: isAdmin
  });

  // 3. Query selected menu item's recipe details
  const { data: recipeData, isLoading: isRecipeLoading } = useQuery<RecipeData>({
    queryKey: ["recipe", selectedMenuId],
    queryFn: async () => {
      const res = await fetch(`/api/menu-items/${selectedMenuId}/recipe`);
      if (!res.ok) throw new Error("Failed to load recipe details");
      return res.json();
    },
    enabled: !!selectedMenuId && isAdmin,
    onSuccess: (data: RecipeData) => {
      if (data?.recipe?.lines) {
        setRecipeLines(
          data.recipe.lines.map((l) => ({
            rawItemId: l.rawItemId,
            qtyPerUnit: Number(l.qtyPerUnit)
          }))
        );
      } else {
        setRecipeLines([]);
      }
    }
  } as any);

  // Mutation: Create raw item
  const createRawMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create raw item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["all-raw-items"] });
      setAddRawModalOpen(false);
      setAddRawName("");
      setAddRawUnit("KG");
      setAddRawMinThreshold("");
      setAddRawCostPrice("");
      setAddRawCurrentStock("");
      setAddRawError(null);
    },
    onError: (err: any) => {
      setAddRawError(err.message || "Failed to add raw item");
    }
  });

  // Mutation: Edit raw item
  const editRawMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update raw item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["all-raw-items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditModalOpen(false);
      setEditItem(null);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.message || "Failed to update raw item");
    }
  });

  // Mutation: Delete raw item
  const deleteRawMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete raw item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["all-raw-items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteModalOpen(false);
      setDeleteItem(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      setDeleteError(err.message || "Failed to delete raw item");
    }
  });

  // Mutation: Reorder raw item purchase
  const reorderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to record reorder purchase");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["all-raw-items"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setReorderModalOpen(false);
      setReorderItem(null);
      setReorderError(null);
    },
    onError: (err: any) => {
      setReorderError(err.message || "Failed to record reorder purchase");
    }
  });

  // Mutation: Adjust stock
  const adjustMutation = useMutation({
    mutationFn: async ({ rawItemId, qtyDelta, reason, costPrice }: { rawItemId: string; qtyDelta: number; reason: string; costPrice?: number }) => {
      const res = await fetch(`/api/inventory/${rawItemId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyDelta, reason, costPrice })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Adjustment failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["all-raw-items"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setAdjustModalOpen(false);
      setAdjustQty("");
      setAdjustCostPrice("");
      setAdjustReason("Restock");
      setSelectedRawItem(null);
    },
    onError: (err: any) => {
      setAdjustError(err.message || "Failed to adjust stock");
    }
  });

  // Mutation: Upsert recipe
  const recipeMutation = useMutation({
    mutationFn: async ({ menuItemId, lines }: { menuItemId: string; lines: Array<{ rawItemId: string; qtyPerUnit: number }> }) => {
      const res = await fetch(`/api/menu-items/${menuItemId}/recipe`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Recipe save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe", selectedMenuId] });
      setRecipeModalOpen(false);
      setSelectedMenuId("");
      setRecipeLines([]);
    },
    onError: (err: any) => {
      setRecipeError(err.message || "Failed to save recipe");
    }
  });

  const handleAddRawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addRawName || !addRawUnit || !addRawMinThreshold || !addRawCostPrice) {
      setAddRawError("Please fill out all required fields.");
      return;
    }

    setAddRawError(null);
    createRawMutation.mutate({
      name: addRawName,
      unit: addRawUnit,
      minThreshold: parseFloat(addRawMinThreshold),
      costPrice: parseFloat(addRawCostPrice),
      currentStock: parseFloat(addRawCurrentStock) || 0
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    if (!editName || !editUnit || !editMinThreshold || !editCostPrice) {
      setEditError("Please fill out all required fields.");
      return;
    }

    setEditError(null);
    editRawMutation.mutate({
      id: editItem.id,
      payload: {
        name: editName,
        unit: editUnit,
        minThreshold: parseFloat(editMinThreshold),
        costPrice: parseFloat(editCostPrice)
      }
    });
  };

  const handleDeleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteItem) return;
    setDeleteError(null);
    deleteRawMutation.mutate(deleteItem.id);
  };

  const handleReorderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reorderItem) return;

    const qtyNum = parseFloat(reorderQty);
    const costNum = parseFloat(reorderUnitCost);

    if (isNaN(qtyNum) || qtyNum <= 0) {
      setReorderError("Please enter a valid positive reorder quantity.");
      return;
    }

    if (isNaN(costNum) || costNum <= 0) {
      setReorderError("Please enter a valid positive unit cost.");
      return;
    }

    setReorderError(null);
    reorderMutation.mutate({
      items: [
        {
          rawItemId: reorderItem.id,
          qty: qtyNum,
          unitCost: costNum
        }
      ],
      supplierName: reorderSupplierName ? reorderSupplierName.trim() : null
    });
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRawItem) return;

    const delta = parseFloat(adjustQty) || 0;
    const newPrice = adjustCostPrice ? parseFloat(adjustCostPrice) : undefined;

    if (delta === 0 && (newPrice === undefined || isNaN(newPrice))) {
      setAdjustError("Please enter a non-zero quantity delta or a new cost price.");
      return;
    }

    setAdjustError(null);
    adjustMutation.mutate({
      rawItemId: selectedRawItem.id,
      qtyDelta: delta,
      reason: adjustReason,
      costPrice: newPrice
    });
  };

  const handleRecipeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuId) return;

    const validLines = recipeLines.filter(line => line.rawItemId && line.qtyPerUnit > 0);
    
    setRecipeError(null);
    recipeMutation.mutate({
      menuItemId: selectedMenuId,
      lines: validLines
    });
  };

  const handleAddRecipeLine = () => {
    setRecipeLines([...recipeLines, { rawItemId: "", qtyPerUnit: 0 }]);
  };

  const handleRemoveRecipeLine = (index: number) => {
    setRecipeLines(recipeLines.filter((_, i) => i !== index));
  };

  const handleRecipeLineChange = (index: number, field: "rawItemId" | "qtyPerUnit", value: any) => {
    const next = [...recipeLines];
    if (field === "qtyPerUnit") {
      next[index][field] = parseFloat(value) || 0;
    } else {
      next[index][field] = value;
    }
    setRecipeLines(next);
  };

  // Real-time live calculations for Recipe Builder
  const selectedMenuItem = menuItems.find((m) => m.id === selectedMenuId);
  const sellPrice = Number(selectedMenuItem?.price || 0);

  const liveRawCost = recipeLines.reduce((sum, line) => {
    if (!line.rawItemId || !line.qtyPerUnit || line.qtyPerUnit <= 0) return sum;
    const rawItem = allRawItems.find((r) => r.id === line.rawItemId);
    const cost = rawItem?.costPrice !== undefined && rawItem?.costPrice !== null ? Number(rawItem.costPrice) : 0;
    return sum + cost * Number(line.qtyPerUnit);
  }, 0);

  const liveGrossProfit = sellPrice - liveRawCost;
  const liveMarginPercent = sellPrice > 0 ? (liveGrossProfit / sellPrice) * 100 : 0;

  // Determine if cost price column is present in the response payloads
  const hasCostData = inventory.length > 0 && inventory[0].costPrice !== null;

  // Build columns for DataTable
  const columns: TableColumn[] = [
    { key: "name", label: "Ingredient Name", sortable: true },
    { key: "unit", label: "Unit", align: "center" },
    {
      key: "currentStock",
      label: "Current Stock",
      align: "right",
      render: (val: number) => Number(val).toFixed(3)
    },
    {
      key: "minThreshold",
      label: "Min Threshold",
      align: "right",
      render: (val: number) => Number(val).toFixed(3)
    }
  ];

  // Dynamically push cost price column if present in raw items payload (preserves Worker privacy)
  if (hasCostData) {
    columns.push({
      key: "costPrice",
      label: "Cost Price (NPR)",
      align: "right",
      render: (val: number) => `Rs. ${Number(val).toFixed(2)}`
    });
  }

  // Stock safety indicator badge column
  columns.push({
    key: "safety",
    label: "Stock Status",
    align: "center",
    render: (_, row: InventoryItem) => {
      const isLow = Number(row.currentStock) < Number(row.minThreshold);
      return <StatusBadge status={isLow ? "OVERDUE" : "VACANT"} />;
    }
  });

  // Action buttons column
  columns.push({
    key: "actions",
    label: "Actions",
    align: "center",
    render: (_, row: InventoryItem) => (
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedRawItem(row);
            setAdjustQty("");
            setAdjustCostPrice(row.costPrice !== null ? String(row.costPrice) : "");
            setAdjustReason("Restock");
            setAdjustError(null);
            setAdjustModalOpen(true);
          }}
          title="Adjust Stock Level or Cost Price"
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-sunken hover:bg-border border border-border text-ink hover:text-primary text-xs font-semibold rounded-control transition-colors"
        >
          <Scale className="h-3.5 w-3.5" />
          <span>Adjust</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditItem(row);
                setEditName(row.name);
                setEditUnit(row.unit);
                setEditMinThreshold(String(row.minThreshold));
                setEditCostPrice(row.costPrice !== null ? String(row.costPrice) : "");
                setEditError(null);
                setEditModalOpen(true);
              }}
              title="Edit Raw Item"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-sunken hover:bg-border border border-border text-ink hover:text-primary text-xs font-semibold rounded-control transition-colors"
            >
              <Pencil className="h-3.5 w-3.5 text-primary" />
              <span>Edit</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setReorderItem(row);
                setReorderQty("");
                setReorderUnitCost(row.costPrice !== null ? String(row.costPrice) : "");
                setReorderSupplierName("");
                setReorderError(null);
                setReorderModalOpen(true);
              }}
              title="Smart Reorder based on last vendor purchase"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-sunken hover:bg-success/15 border border-border text-ink hover:text-success text-xs font-semibold rounded-control transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 text-success" />
              <span>Reorder</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteItem(row);
                setDeleteError(null);
                setDeleteModalOpen(true);
              }}
              title="Delete Raw Item"
              className="inline-flex items-center gap-1 px-2 py-1 bg-surface-sunken hover:bg-danger/10 border border-border text-ink hover:text-danger text-xs font-semibold rounded-control transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5 text-danger" />
              <span>Delete</span>
            </button>
          </>
        )}
      </div>
    )
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raw Inventory & Recipes"
        description="Monitor physical stock levels, manage raw items, reorder from suppliers, and update menu ingredient configurations."
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setAddRawName("");
                  setAddRawUnit("KG");
                  setAddRawMinThreshold("");
                  setAddRawCostPrice("");
                  setAddRawCurrentStock("");
                  setAddRawError(null);
                  setAddRawModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-success text-white text-xs font-semibold rounded-control shadow-sm hover:bg-success-hover active:scale-[0.99] transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Add Raw Item</span>
              </button>
              <button
                onClick={() => {
                  setSelectedMenuId("");
                  setRecipeLines([]);
                  setRecipeModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover active:scale-[0.99] transition-all"
              >
                <FileText className="h-4 w-4" />
                <span>Recipe Builder</span>
              </button>
            </div>
          )
        }
      />

      {/* Search and Limit Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-card border border-border bg-card shadow-xs">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search raw ingredients..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-control border border-border bg-surface-sunken/45 pl-3 pr-4 py-1.5 text-xs text-ink placeholder-ink-muted/60 outline-none focus:border-primary focus:bg-card transition-all"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto select-none">
          <span className="text-xs text-ink-muted">Show:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="rounded-control border border-border bg-card text-ink font-semibold px-2.5 py-1 text-xs outline-none focus:border-primary shadow-xs cursor-pointer"
          >
            <option value={10}>10 records</option>
            <option value={15}>15 records</option>
            <option value={25}>25 records</option>
            <option value={50}>50 records</option>
          </select>
        </div>
      </div>

      {/* Main inventory datatable list */}
      {isInvLoading ? (
        <div className="flex h-[30vh] w-full items-center justify-center text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            data={inventory}
            emptyMessage="No inventory raw items found."
          />
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

      {/* MODAL 1: ADJUST STOCK & COST PRICE */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false);
          setSelectedRawItem(null);
          setAdjustQty("");
          setAdjustCostPrice("");
          setAdjustError(null);
        }}
        title={`Adjust Stock & Cost Price — ${selectedRawItem?.name || ""}`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setAdjustModalOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="adjust-form"
              disabled={adjustMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {adjustMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Submit Adjustment</span>
            </button>
          </>
        }
      >
        <form id="adjust-form" onSubmit={handleAdjustSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 bg-surface-sunken p-3 rounded-control border border-border">
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                Current Stock Level
              </label>
              <p className="text-sm font-bold text-ink tabular-nums">
                {selectedRawItem ? `${selectedRawItem.currentStock.toFixed(3)} ${selectedRawItem.unit}` : "-"}
              </p>
            </div>
            {isAdmin && selectedRawItem?.costPrice !== null && (
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                  Current Cost Price
                </label>
                <p className="text-sm font-bold text-primary tabular-nums">
                  {selectedRawItem ? `Rs. ${Number(selectedRawItem.costPrice).toFixed(2)}` : "-"}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
              Adjustment Quantity Delta
            </label>
            <input
              type="number"
              step="0.001"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="e.g. 5.0 for restock, -2.5 for waste"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
            <span className="text-[10px] text-ink-muted mt-1 block">
              Enter a positive number for restock additions, or a negative number for wastage/deductions.
            </span>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                Cost Price per Unit (NPR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={adjustCostPrice}
                onChange={(e) => setAdjustCostPrice(e.target.value)}
                placeholder="e.g. 350.00"
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
              <span className="text-[10px] text-ink-muted mt-1 block">
                Update unit cost price alongside stock level if market prices have changed.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
              Reason Description *
            </label>
            <input
              type="text"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="e.g. Supplier delivery, Spoilage, Waste"
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          {adjustError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
              {adjustError}
            </div>
          )}
        </form>
      </Modal>

      {/* MODAL 2: EDIT RAW ITEM */}
      {isAdmin && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditItem(null);
            setEditError(null);
          }}
          title={`Edit Raw Ingredient — ${editItem?.name || ""}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-raw-form"
                disabled={editRawMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {editRawMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </>
          }
        >
          <form id="edit-raw-form" onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                Ingredient Name *
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Garlic, Pork Belly, Buffalo Meat"
                required
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Measurement Unit *
                </label>
                <select
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  required
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink bg-white outline-none focus:border-primary"
                >
                  <option value="KG">KG (Kilogram)</option>
                  <option value="LITRE">LITRE (Litre)</option>
                  <option value="ML">ML (Milliliter)</option>
                  <option value="PIECE">PIECE (Piece)</option>
                  <option value="PACKET">PACKET (Packet)</option>
                  <option value="PLATE">PLATE (Plate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Min Safety Threshold *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={editMinThreshold}
                  onChange={(e) => setEditMinThreshold(e.target.value)}
                  placeholder="e.g. 5.0"
                  required
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                Cost Price per Unit (NPR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editCostPrice}
                onChange={(e) => setEditCostPrice(e.target.value)}
                placeholder="e.g. 300.00"
                required
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            {editError && (
              <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
                {editError}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {isAdmin && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDeleteItem(null);
            setDeleteError(null);
          }}
          title={`Delete Raw Ingredient — ${deleteItem?.name || ""}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={deleteRawMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-xs font-semibold rounded-control shadow-sm hover:bg-danger-hover disabled:opacity-50 transition-colors"
              >
                {deleteRawMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-control bg-danger/10 border border-danger/20 text-danger">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Are you sure you want to delete this raw ingredient?</p>
                <p className="text-ink-muted">
                  Deleting <strong className="text-ink">{deleteItem?.name}</strong> is permanent. Note that raw items configured in menu recipes or having purchase records cannot be deleted.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger font-semibold">
                {deleteError}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL 4: SMART REORDER */}
      {isAdmin && (
        <Modal
          isOpen={reorderModalOpen}
          onClose={() => {
            setReorderModalOpen(false);
            setReorderItem(null);
            setReorderError(null);
          }}
          title={`Smart Reorder — ${reorderItem?.name || ""}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setReorderModalOpen(false)}
                className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="reorder-form"
                disabled={reorderMutation.isPending || isLastPurchaseLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-success text-white text-xs font-semibold rounded-control shadow-sm hover:bg-success-hover disabled:opacity-50 transition-colors"
              >
                {reorderMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Reorder & Add Stock</span>
              </button>
            </>
          }
        >
          <form id="reorder-form" onSubmit={handleReorderSubmit} className="space-y-4">
            {/* Last Purchase Info Banner */}
            {isLastPurchaseLoading ? (
              <div className="flex items-center justify-center py-4 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs ml-2 font-medium">Fetching last vendor purchase history...</span>
              </div>
            ) : lastPurchaseData && !lastPurchaseData.notFound ? (
              <div className="rounded-card bg-surface-sunken p-3.5 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-success uppercase tracking-wider flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Last Purchase Pattern Pre-filled
                  </span>
                  <span className="text-[10px] text-ink-muted flex items-center gap-1 font-mono">
                    <Calendar className="h-3 w-3" />
                    {new Date(lastPurchaseData.purchasedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white dark:bg-card p-2 rounded-control border border-border">
                    <span className="text-[10px] text-ink-muted uppercase block font-semibold">Vendor</span>
                    <p className="font-bold text-ink truncate">{lastPurchaseData.supplierName || "Unspecified"}</p>
                  </div>
                  <div className="bg-white dark:bg-card p-2 rounded-control border border-border">
                    <span className="text-[10px] text-ink-muted uppercase block font-semibold">Qty</span>
                    <p className="font-bold text-ink">{lastPurchaseData.qty} {reorderItem?.unit}</p>
                  </div>
                  <div className="bg-white dark:bg-card p-2 rounded-control border border-border">
                    <span className="text-[10px] text-ink-muted uppercase block font-semibold">Unit Cost</span>
                    <p className="font-bold text-primary">Rs. {lastPurchaseData.unitCost.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-control bg-warning/10 border border-warning/20 text-xs text-warning font-semibold">
                No prior vendor purchase recorded for this ingredient. Standard pricing values populated below.
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                Supplier / Vendor Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
                <input
                  type="text"
                  value={reorderSupplierName}
                  onChange={(e) => setReorderSupplierName(e.target.value)}
                  placeholder="e.g. Kalimati Wholesalers, ABC Meat Suppliers"
                  className="w-full rounded-control border border-border pl-9 pr-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Reorder Quantity ({reorderItem?.unit}) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={reorderQty}
                  onChange={(e) => setReorderQty(e.target.value)}
                  placeholder="e.g. 10.0"
                  required
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Unit Cost Price (NPR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={reorderUnitCost}
                  onChange={(e) => setReorderUnitCost(e.target.value)}
                  placeholder="e.g. 300.00"
                  required
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary font-mono"
                />
              </div>
            </div>

            {/* Total Estimated Cost calculation */}
            {reorderQty && reorderUnitCost && !isNaN(parseFloat(reorderQty)) && !isNaN(parseFloat(reorderUnitCost)) && (
              <div className="flex items-center justify-between p-3 rounded-control bg-surface-sunken border border-border">
                <span className="text-xs font-bold text-ink-muted uppercase">Total Purchase Amount</span>
                <span className="text-sm font-black text-success font-mono tabular-nums">
                  Rs. {(parseFloat(reorderQty) * parseFloat(reorderUnitCost)).toFixed(2)}
                </span>
              </div>
            )}

            {reorderError && (
              <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
                {reorderError}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* MODAL 5: RECIPE BUILDER */}
      {isAdmin && (
        <Modal
          isOpen={recipeModalOpen}
          onClose={() => {
            setRecipeModalOpen(false);
            setSelectedMenuId("");
            setRecipeLines([]);
            setRecipeError(null);
          }}
          title="Recipe Builder & Ingredient Costing"
          className="max-w-[96vw] md:max-w-7xl w-full h-[90vh] flex flex-col"
          footer={
            <>
              <button
                type="button"
                onClick={() => setRecipeModalOpen(false)}
                className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="recipe-form"
                disabled={recipeMutation.isPending || !selectedMenuId}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {recipeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save Recipe</span>
              </button>
            </>
          }
        >
          <form id="recipe-form" onSubmit={handleRecipeSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                Select Menu Item
              </label>
              <SearchableSelect
                value={selectedMenuId}
                onChange={(val) => setSelectedMenuId(val)}
                options={menuItems.map((item) => ({
                  id: item.id,
                  label: `${item.name} (Rs. ${Number(item.price).toFixed(2)})`
                }))}
                placeholder="-- Choose Menu Item --"
              />
            </div>

            {/* Live Pricing Breakdown */}
            {selectedMenuId && isRecipeLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {selectedMenuId && !isRecipeLoading && (
              <div className="rounded-card bg-surface-sunken p-4 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wide">Live Margin Calculations</h4>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Real-time Dynamic Costing
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white dark:bg-card rounded-control p-2.5 border border-border shadow-2xs">
                    <span className="text-[10px] text-ink-muted uppercase font-bold">Sell Price</span>
                    <p className="text-sm font-black text-ink mt-0.5 tabular-nums">
                      Rs. {sellPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-card rounded-control p-2.5 border border-border shadow-2xs">
                    <span className="text-[10px] text-ink-muted uppercase font-bold">Raw Cost (Live)</span>
                    <p className="text-sm font-black text-primary mt-0.5 tabular-nums">
                      Rs. {liveRawCost.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-card rounded-control p-2.5 border border-border shadow-2xs">
                    <span className="text-[10px] text-ink-muted uppercase font-bold">Gross Profit</span>
                    <p
                      className={cn(
                        "text-sm font-black mt-0.5 tabular-nums",
                        liveGrossProfit >= 0 ? "text-success" : "text-danger"
                      )}
                    >
                      Rs. {liveGrossProfit.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-card rounded-control p-2.5 border border-border shadow-2xs">
                    <span className="text-[10px] text-ink-muted uppercase font-bold">Gross Margin</span>
                    <p
                      className={cn(
                        "text-sm font-black mt-0.5 tabular-nums",
                        liveMarginPercent >= 60
                          ? "text-success"
                          : liveMarginPercent >= 30
                          ? "text-warning"
                          : "text-danger"
                      )}
                    >
                      {liveMarginPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Recipe Lines */}
            {selectedMenuId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-xs font-bold text-ink-muted uppercase">Ingredient Recipe Lines</h4>
                  <button
                    type="button"
                    onClick={handleAddRecipeLine}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="space-y-2.5 pr-1">
                  {recipeLines.map((line, idx) => {
                    const rawItem = allRawItems.find((r) => r.id === line.rawItemId);
                    const costPrice = rawItem?.costPrice !== undefined && rawItem?.costPrice !== null ? Number(rawItem.costPrice) : 0;
                    const lineSubtotal = costPrice * Number(line.qtyPerUnit || 0);

                    return (
                      <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-3 items-end p-2.5 rounded-control bg-card border border-border/70 shadow-2xs">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                            Ingredient
                          </label>
                          <SearchableSelect
                            value={line.rawItemId}
                            onChange={(val) => handleRecipeLineChange(idx, "rawItemId", val)}
                            options={allRawItems.map((item) => ({
                              id: item.id,
                              label: `${item.name} (${item.unit})${item.costPrice !== null ? ` — Rs. ${Number(item.costPrice).toFixed(2)}/${item.unit}` : ""}`
                            }))}
                            placeholder="-- Choose Raw Ingredient --"
                          />
                        </div>

                        <div className="w-28">
                          <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                            Qty Per Unit
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            value={line.qtyPerUnit || ""}
                            onChange={(e) => handleRecipeLineChange(idx, "qtyPerUnit", e.target.value)}
                            required
                            placeholder="e.g. 0.350"
                            className="w-full rounded-control border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary font-mono"
                          />
                        </div>

                        {/* Live Line Cost Subtotal */}
                        <div className="w-28 text-right">
                          <span className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                            Line Cost
                          </span>
                          <div className="px-2.5 py-1.5 rounded-control bg-surface-sunken border border-border text-xs font-mono font-bold text-primary tabular-nums">
                            Rs. {lineSubtotal.toFixed(2)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveRecipeLine(idx)}
                          className="px-2.5 py-1.5 border border-border hover:border-danger hover:text-danger rounded-control transition-colors text-xs font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                  {recipeLines.length === 0 && (
                    <p className="text-xs text-ink-muted italic text-center py-4">
                      No ingredients configured. Click "+ Add Line" to select raw items.
                    </p>
                  )}
                </div>
              </div>
            )}

            {recipeError && (
              <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
                {recipeError}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* MODAL 6: ADD NEW RAW ITEM */}
      {isAdmin && (
        <Modal
          isOpen={addRawModalOpen}
          onClose={() => {
            setAddRawModalOpen(false);
            setAddRawError(null);
          }}
          title="Add New Raw Inventory Item"
          footer={
            <>
              <button
                type="button"
                onClick={() => setAddRawModalOpen(false)}
                className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-raw-form"
                disabled={createRawMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-success text-white text-xs font-semibold rounded-control shadow-sm hover:bg-success-hover disabled:opacity-50 transition-colors"
              >
                {createRawMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Create Item</span>
              </button>
            </>
          }
        >
          <form id="add-raw-form" onSubmit={handleAddRawSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                Ingredient Name *
              </label>
              <input
                type="text"
                value={addRawName}
                onChange={(e) => setAddRawName(e.target.value)}
                placeholder="e.g. Garlic, Pork Belly, Buffalo Meat"
                required
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Measurement Unit *
                </label>
                <select
                  value={addRawUnit}
                  onChange={(e) => setAddRawUnit(e.target.value)}
                  required
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink bg-white outline-none focus:border-primary"
                >
                  <option value="KG">KG (Kilogram)</option>
                  <option value="LITRE">LITRE (Litre)</option>
                  <option value="ML">ML (Milliliter)</option>
                  <option value="PIECE">PIECE (Piece)</option>
                  <option value="PACKET">PACKET (Packet)</option>
                  <option value="PLATE">PLATE (Plate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Initial Stock Level
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={addRawCurrentStock}
                  onChange={(e) => setAddRawCurrentStock(e.target.value)}
                  placeholder="e.g. 10.0"
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Min Safety Threshold *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={addRawMinThreshold}
                  onChange={(e) => setAddRawMinThreshold(e.target.value)}
                  placeholder="e.g. 5.0"
                  required
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Cost Price per Unit (NPR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addRawCostPrice}
                  onChange={(e) => setAddRawCostPrice(e.target.value)}
                  placeholder="e.g. 650.00"
                  required
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            {addRawError && (
              <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
                {addRawError}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
