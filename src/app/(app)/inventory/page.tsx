"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, TableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal-sheet";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Scale, FileText, Loader2, Plus } from "lucide-react";
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

  // Selected item states for Modals
  const [selectedRawItem, setSelectedRawItem] = useState<InventoryItem | null>(null);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("Restock");
  const [adjustError, setAdjustError] = useState<string | null>(null);

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

  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  // 1.5. Query all raw items for Recipe Builder (bypass pagination, up to 1000 items)
  const { data: allRawItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["all-raw-items"],
    queryFn: async () => {
      const res = await fetch("/api/inventory?page=1&limit=1000");
      if (!res.ok) throw new Error("Failed to load all inventory items");
      const result = await res.json();
      return result.data || [];
    },
    enabled: recipeModalOpen && isAdmin
  });

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
    // Initialize editing lines when recipe loads
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

  // 4. Mutation: Adjust stock
  const adjustMutation = useMutation({
    mutationFn: async ({ rawItemId, qtyDelta, reason }: { rawItemId: string; qtyDelta: number; reason: string }) => {
      const res = await fetch(`/api/inventory/${rawItemId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qtyDelta, reason })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Adjustment failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setAdjustModalOpen(false);
      setAdjustQty("");
      setAdjustReason("Restock");
      setSelectedRawItem(null);
    },
    onError: (err: any) => {
      setAdjustError(err.message || "Failed to adjust stock");
    }
  });

  // 5. Mutation: Upsert recipe
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

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRawItem) return;

    const delta = parseFloat(adjustQty);
    if (isNaN(delta) || delta === 0) {
      setAdjustError("Please enter a valid, non-zero quantity.");
      return;
    }

    setAdjustError(null);
    adjustMutation.mutate({
      rawItemId: selectedRawItem.id,
      qtyDelta: delta,
      reason: adjustReason
    });
  };

  const handleRecipeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuId) return;

    // Filter out invalid/empty lines
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

  // Action adjustments buttons
  columns.push({
    key: "actions",
    label: "Actions",
    align: "center",
    render: (_, row: InventoryItem) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSelectedRawItem(row);
          setAdjustModalOpen(true);
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-sunken hover:bg-border border border-border text-ink hover:text-primary text-xs font-semibold rounded-control transition-colors"
      >
        <Scale className="h-3.5 w-3.5" />
        <span>Adjust</span>
      </button>
    )
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raw Inventory & Recipes"
        description="Monitor physical stock levels and update menu ingredient configurations."
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
              setPage(1); // Reset to page 1 on search
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

      {/* MODAL 1: ADJUST STOCK */}
      <Modal
        isOpen={adjustModalOpen}
        onClose={() => {
          setAdjustModalOpen(false);
          setSelectedRawItem(null);
          setAdjustQty("");
          setAdjustError(null);
        }}
        title={`Adjust Stock — ${selectedRawItem?.name || ""}`}
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
          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
              Current Stock level
            </label>
            <p className="text-sm font-bold text-ink tabular-nums">
              {selectedRawItem ? `${selectedRawItem.currentStock.toFixed(3)} ${selectedRawItem.unit}` : "-"}
            </p>
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
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
            <span className="text-[10px] text-ink-muted mt-1 block">
              Enter a positive number for restock additions, or a negative number for wastage/deductions.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
              Reason Description
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

      {/* MODAL 2: RECIPE BUILDER */}
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

            {selectedMenuId && !isRecipeLoading && recipeData && (
              <div className="rounded-card bg-surface-sunken p-4 border border-border space-y-2">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wide">Live Margin Calculations</h4>
                <div className="grid grid-cols-3 gap-4 text-center mt-2">
                  <div className="bg-white dark:bg-card rounded-control p-2 border border-border">
                    <span className="text-[10px] text-ink-muted uppercase font-bold">Sell Price</span>
                    <p className="text-sm font-bold text-ink mt-0.5 tabular-nums">
                      Rs. {Number(menuItems.find(m => m.id === selectedMenuId)?.price || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-card rounded-control p-2 border border-border">
                    <span className="text-[10px] text-ink-muted uppercase font-bold">Raw Cost</span>
                    <p className="text-sm font-bold text-ink mt-0.5 tabular-nums">
                      {recipeData.costPerUnit !== null ? `Rs. ${recipeData.costPerUnit.toFixed(2)}` : "-"}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-card rounded-control p-2 border border-border">
                    <span className="text-[10px] text-ink-muted uppercase font-bold">Gross Profit</span>
                    {recipeData.costPerUnit !== null ? (
                      <p
                        className={cn(
                          "text-sm font-bold mt-0.5 tabular-nums",
                          Number(menuItems.find(m => m.id === selectedMenuId)?.price || 0) - recipeData.costPerUnit >= 0
                            ? "text-success"
                            : "text-danger"
                        )}
                      >
                        Rs. {(Number(menuItems.find(m => m.id === selectedMenuId)?.price || 0) - recipeData.costPerUnit).toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-ink mt-0.5">-</p>
                    )}
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
                  {recipeLines.map((line, idx) => (
                    <div key={idx} className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                          Ingredient
                        </label>
                        <SearchableSelect
                          value={line.rawItemId}
                          onChange={(val) => handleRecipeLineChange(idx, "rawItemId", val)}
                          options={allRawItems.map((item) => ({
                            id: item.id,
                            label: `${item.name} (${item.unit})`
                          }))}
                          placeholder="-- Choose Raw Ingredient --"
                        />
                      </div>

                      <div className="w-32">
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
                          className="w-full rounded-control border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeLine(idx)}
                        className="px-2.5 py-1.5 border border-border hover:border-danger hover:text-danger rounded-control transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
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

      {/* MODAL 3: ADD NEW RAW ITEM */}
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
                  <option value="PIECE">PIECE (Piece)</option>
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
