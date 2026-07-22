"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal-sheet";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { 
  Plus, 
  Filter, 
  Loader2, 
  Trash, 
  Eye, 
  Pencil, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  List, 
  Building2, 
  AlertTriangle 
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";

interface RawItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
}

interface PurchaseRecord {
  id: string;
  rawItemId: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  supplierName: string | null;
  purchasedAt: string;
  rawItem: {
    id?: string;
    name: string;
    unit: string;
  };
  recordedBy: {
    role: string;
  };
}

interface GroupedBatch {
  key: string;
  supplierName: string;
  purchasedAt: string;
  recordedByRole: string;
  totalCost: number;
  items: PurchaseRecord[];
}

export default function PurchasesPage() {
  const queryClient = useQueryClient();

  // View Mode: "grouped" (by Vendor batch with Hide/Show details) or "flat" (all rows)
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");

  // Track expanded vendor batch groups in grouped mode
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});

  // Filters state
  const [filterRawItemId, setFilterRawItemId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination & Search state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  // Record Purchase Modal form states
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  interface PurchaseLine {
    rawItemId: string;
    qty: string;
    unitCost: string;
  }
  const [lines, setLines] = useState<PurchaseLine[]>([{ rawItemId: "", qty: "", unitCost: "" }]);
  const [recordError, setRecordError] = useState<string | null>(null);

  // View Modal state
  const [viewItem, setViewItem] = useState<PurchaseRecord | null>(null);
  const [viewBatch, setViewBatch] = useState<GroupedBatch | null>(null);

  // Edit Modal state
  const [editItem, setEditItem] = useState<PurchaseRecord | null>(null);
  const [editRawItemId, setEditRawItemId] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editUnitCost, setEditUnitCost] = useState("");
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirmation Modal state
  const [deleteItem, setDeleteItem] = useState<PurchaseRecord | null>(null);

  // 1. Fetch raw items for select lists
  const { data: rawItems = [] } = useQuery<RawItem[]>({
    queryKey: ["inventory-list-all"],
    queryFn: async () => {
      const res = await fetch("/api/inventory?limit=1000");
      if (!res.ok) throw new Error("Failed to load raw ingredients");
      const json = await res.json();
      return json.data || [];
    }
  });

  // 2. Fetch filterable purchases history list
  const { data: paginatedData, isLoading: isPurchasesLoading } = useQuery<{ data: PurchaseRecord[]; pagination: any }>({
    queryKey: ["purchases", filterRawItemId, startDate, endDate, page, limit, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterRawItemId) params.append("rawItemId", filterRawItemId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("page", String(page));
      params.append("limit", String(limit));
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/purchases?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to retrieve purchases history");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });
  const purchases = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

  // Group purchases by Vendor + PurchasedAt Timestamp
  const groupedBatches: GroupedBatch[] = React.useMemo(() => {
    const map = new Map<string, GroupedBatch>();

    for (const record of purchases) {
      const vendorName = record.supplierName ? record.supplierName.trim() : "Unspecified Vendor";
      // Group by vendor name + minute timestamp to aggregate multi-item purchase entries
      const timeKey = record.purchasedAt ? record.purchasedAt.substring(0, 16) : "no-date";
      const key = `${vendorName}__${timeKey}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          supplierName: vendorName,
          purchasedAt: record.purchasedAt,
          recordedByRole: record.recordedBy?.role || "USER",
          totalCost: 0,
          items: []
        });
      }

      const batch = map.get(key)!;
      batch.items.push(record);
      batch.totalCost += Number(record.totalCost || 0);
    }

    return Array.from(map.values());
  }, [purchases]);

  const toggleGroupExpanded = (key: string) => {
    setExpandedGroupKeys((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // 3. Mutation: Record new purchase
  const recordMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Recording purchase failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setRecordModalOpen(false);
      setLines([{ rawItemId: "", qty: "", unitCost: "" }]);
      setSupplierName("");
      setRecordError(null);
    },
    onError: (err: any) => {
      setRecordError(err.message || "Failed to record purchase entry");
    }
  });

  // 4. Mutation: Update purchase
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/purchases/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Updating purchase failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setEditItem(null);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.message || "Failed to update purchase entry");
    }
  });

  // 5. Mutation: Delete purchase
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/purchases/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Deleting purchase failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setDeleteItem(null);
    }
  });

  const handleAddLine = () => {
    setLines([...lines, { rawItemId: "", qty: "", unitCost: "" }]);
  };

  const handleRemoveLine = (index: number) => {
    const updated = lines.filter((_, i) => i !== index);
    setLines(updated);
  };

  const handleLineChange = (index: number, field: keyof PurchaseLine, value: string) => {
    const updated = lines.map((line, i) => {
      if (i === index) {
        return { ...line, [field]: value };
      }
      return line;
    });
    setLines(updated);
  };

  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.rawItemId) {
        setRecordError(`Please select a raw ingredient for line ${i + 1}.`);
        return;
      }

      const qtyNum = parseFloat(line.qty);
      const costNum = parseFloat(line.unitCost);

      if (isNaN(qtyNum) || qtyNum <= 0) {
        setRecordError(`Quantity for line ${i + 1} must be a positive number.`);
        return;
      }

      if (isNaN(costNum) || costNum <= 0) {
        setRecordError(`Unit cost for line ${i + 1} must be a positive number.`);
        return;
      }
    }

    setRecordError(null);

    const formattedItems = lines.map((line) => ({
      rawItemId: line.rawItemId,
      qty: parseFloat(line.qty),
      unitCost: parseFloat(line.unitCost)
    }));

    recordMutation.mutate({
      items: formattedItems,
      supplierName: supplierName.trim() || undefined
    });
  };

  const handleOpenEdit = (item: PurchaseRecord) => {
    setEditItem(item);
    setEditRawItemId(item.rawItemId);
    setEditQty(String(item.qty));
    setEditUnitCost(String(item.unitCost));
    setEditSupplierName(item.supplierName || "");
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    const qtyNum = parseFloat(editQty);
    const unitCostNum = parseFloat(editUnitCost);

    if (isNaN(qtyNum) || qtyNum <= 0) {
      setEditError("Quantity must be a positive number.");
      return;
    }

    if (isNaN(unitCostNum) || unitCostNum <= 0) {
      setEditError("Unit cost must be a positive number.");
      return;
    }

    setEditError(null);
    updateMutation.mutate({
      id: editItem.id,
      payload: {
        rawItemId: editRawItemId,
        qty: qtyNum,
        unitCost: unitCostNum,
        supplierName: editSupplierName.trim() || null
      }
    });
  };

  const handleClearFilters = () => {
    setFilterRawItemId("");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setPage(1);
  };

  // Table Columns for Flat View
  const flatColumns = [
    {
      key: "purchasedAt",
      label: "Purchase Date",
      sortable: true,
      render: (val: string) => new Date(val).toLocaleDateString()
    },
    {
      key: "name",
      label: "Ingredient Name",
      render: (_: any, row: PurchaseRecord) => row.rawItem.name
    },
    {
      key: "qty",
      label: "Quantity",
      align: "right" as const,
      render: (val: number, row: PurchaseRecord) => `${Number(val).toFixed(3)} ${row.rawItem.unit}`
    },
    {
      key: "unitCost",
      label: "Unit Cost",
      align: "right" as const,
      render: (val: number) => `Rs. ${Number(val).toFixed(2)}`
    },
    {
      key: "totalCost",
      label: "Total Cost",
      align: "right" as const,
      render: (val: number) => `Rs. ${Number(val).toFixed(2)}`
    },
    {
      key: "supplierName",
      label: "Supplier Vendor",
      render: (val: string | null) => (
        <span className="font-medium text-ink">
          {val || <span className="text-ink-muted italic">Unspecified</span>}
        </span>
      )
    },
    {
      key: "buyer",
      label: "Recorded By",
      render: (_: any, row: PurchaseRecord) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-sunken border border-border text-ink-muted uppercase">
          {row.recordedBy.role.toLowerCase().replace(/_/g, " ")}
        </span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      align: "center" as const,
      render: (_: any, row: PurchaseRecord) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setViewItem(row)}
            className="p-1.5 hover:bg-primary/10 text-ink-muted hover:text-primary rounded-control transition-colors"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 hover:bg-warning/10 text-ink-muted hover:text-warning rounded-control transition-colors"
            title="Edit Purchase"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteItem(row)}
            className="p-1.5 hover:bg-danger/10 text-ink-muted hover:text-danger rounded-control transition-colors"
            title="Delete Purchase"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Ledger"
        description="Verify raw supply acquisitions, cost sheets, and distributor accounts."
        actions={
          <button
            onClick={() => setRecordModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover active:scale-[0.99] transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Record Purchase</span>
          </button>
        }
      />

      {/* FILTER & VIEW MODE CONTROL BAR */}
      <div className="rounded-card border border-border bg-card p-4 space-y-4 shadow-xs select-none">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-ink-muted" />
            <h4 className="text-xs font-bold text-ink uppercase tracking-wide">Filter Purchases</h4>
          </div>

          {/* View Mode Switch (Grouped by Vendor vs Flat List) */}
          <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-control border border-border">
            <button
              onClick={() => setViewMode("grouped")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-control transition-all",
                viewMode === "grouped"
                  ? "bg-white text-primary shadow-xs font-bold"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Grouped by Vendor</span>
            </button>
            <button
              onClick={() => setViewMode("flat")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-control transition-all",
                viewMode === "flat"
                  ? "bg-white text-primary shadow-xs font-bold"
                  : "text-ink-muted hover:text-ink"
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span>All Products List</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Raw Ingredient
            </label>
            <select
              value={filterRawItemId}
              onChange={(e) => {
                setFilterRawItemId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-control border border-border px-3 py-1.5 text-xs text-ink bg-white outline-none focus:border-primary"
            >
              <option value="">-- All Ingredients --</option>
              {rawItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Search Ingredient
            </label>
            <input
              type="text"
              placeholder="e.g. Pork..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-control border border-border px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-control border border-border px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-control border border-border px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Show Limit
            </label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="w-full rounded-control border border-border px-3 py-1.5 text-xs text-ink bg-white outline-none focus:border-primary"
            >
              <option value={10}>10 records</option>
              <option value={15}>15 records</option>
              <option value={25}>25 records</option>
              <option value={50}>50 records</option>
            </select>
          </div>
        </div>

        {(filterRawItemId || startDate || endDate || searchQuery) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleClearFilters}
              className="text-xs text-primary font-bold hover:underline"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* PURCHASES LIST TABLE & VENDOR GROUPED VIEW */}
      {isPurchasesLoading ? (
        <div className="flex h-[30vh] w-full items-center justify-center text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : viewMode === "grouped" ? (
        /* VENDOR GROUPED BATCHES VIEW WITH EXPANDABLE HIDE/SHOW DETAILS */
        <div className="space-y-4">
          <div className="w-full overflow-x-auto rounded-card border border-border bg-card shadow-xs">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border bg-surface-sunken text-xs font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Purchase Date</th>
                  <th className="px-4 py-3">Supplier Vendor</th>
                  <th className="px-4 py-3 text-center">Items Count</th>
                  <th className="px-4 py-3 text-right">Total Batch Cost</th>
                  <th className="px-4 py-3 text-center">Recorded By</th>
                  <th className="px-4 py-3 text-center">Product Details</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-ink">
                {groupedBatches.length > 0 ? (
                  groupedBatches.map((batch) => {
                    const isExpanded = !!expandedGroupKeys[batch.key];

                    return (
                      <React.Fragment key={batch.key}>
                        {/* Summary Row per Vendor Batch */}
                        <tr className="hover:bg-surface-sunken/40 transition-colors">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {new Date(batch.purchasedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 font-semibold text-ink">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              <span>{batch.supplierName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                              {batch.items.length} {batch.items.length === 1 ? "Product" : "Products"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                            Rs. {batch.totalCost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-sunken border border-border text-ink-muted uppercase">
                              {batch.recordedByRole.toLowerCase().replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {/* HIDE / SHOW BUTTON TO TOGGLE PRODUCT DETAILS */}
                            <button
                              onClick={() => toggleGroupExpanded(batch.key)}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-semibold transition-all border shadow-xs",
                                isExpanded
                                  ? "bg-primary text-white border-primary hover:bg-primary-hover"
                                  : "bg-surface-sunken hover:bg-border text-ink border-border"
                              )}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5" />
                                  <span>Hide Details</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                  <span>Show Details ({batch.items.length})</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => setViewBatch(batch)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-surface-sunken hover:bg-border text-ink rounded-control border border-border transition-colors"
                              title="View Vendor Batch Order"
                            >
                              <Eye className="h-3.5 w-3.5 text-primary" />
                              <span>View Order</span>
                            </button>
                          </td>
                        </tr>

                        {/* COLLAPSIBLE DETAILS SUB-TABLE */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="p-0 bg-surface-sunken/30 border-b border-border/70">
                              <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-xs font-bold text-ink-muted uppercase tracking-wide">
                                    Products Ordered from {batch.supplierName} ({new Date(batch.purchasedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                                  </h5>
                                  <span className="text-[11px] text-ink-muted font-medium">
                                    Click pencil to Edit or trash icon to Delete an individual product log.
                                  </span>
                                </div>

                                <div className="overflow-x-auto rounded-control border border-border bg-white dark:bg-card shadow-2xs">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-surface-sunken border-b border-border text-ink-muted uppercase font-bold">
                                      <tr>
                                        <th className="px-3 py-2">Ingredient Name</th>
                                        <th className="px-3 py-2 text-right">Quantity</th>
                                        <th className="px-3 py-2 text-right">Unit Cost</th>
                                        <th className="px-3 py-2 text-right">Total Line Cost</th>
                                        <th className="px-3 py-2 text-center">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/60">
                                      {batch.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-surface-sunken/40">
                                          <td className="px-3 py-2.5 font-semibold text-ink">
                                            {item.rawItem.name}
                                          </td>
                                          <td className="px-3 py-2.5 text-right font-mono text-ink">
                                            {Number(item.qty).toFixed(3)} {item.rawItem.unit}
                                          </td>
                                          <td className="px-3 py-2.5 text-right font-mono text-ink">
                                            Rs. {Number(item.unitCost).toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">
                                            Rs. {Number(item.totalCost).toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                              <button
                                                onClick={() => setViewItem(item)}
                                                className="p-1 hover:bg-primary/10 text-ink-muted hover:text-primary rounded-control transition-colors"
                                                title="View Item"
                                              >
                                                <Eye className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                onClick={() => handleOpenEdit(item)}
                                                className="p-1 hover:bg-warning/10 text-ink-muted hover:text-warning rounded-control transition-colors"
                                                title="Edit Item"
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </button>
                                              <button
                                                onClick={() => setDeleteItem(item)}
                                                className="p-1 hover:bg-danger/10 text-ink-muted hover:text-danger rounded-control transition-colors"
                                                title="Delete Item"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-ink-muted">
                      No purchase records match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
      ) : (
        /* FLAT PRODUCTS LIST VIEW */
        <div className="space-y-4">
          <DataTable
            columns={flatColumns}
            data={purchases}
            emptyMessage="No purchase records match the selected filters."
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

      {/* MODAL: VIEW ITEM DETAILS */}
      <Modal
        isOpen={!!viewItem}
        onClose={() => setViewItem(null)}
        title="Purchase Record Details"
        className="max-w-md"
        footer={
          <button
            onClick={() => setViewItem(null)}
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-colors"
          >
            Close
          </button>
        }
      >
        {viewItem && (
          <div className="space-y-4">
            <div className="rounded-card bg-surface-sunken p-4 border border-border space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-ink-muted uppercase">Ingredient Name</span>
                <span className="text-sm font-bold text-ink">{viewItem.rawItem.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-ink-muted uppercase">Quantity Purchased</span>
                <span className="text-sm font-semibold font-mono text-ink">
                  {Number(viewItem.qty).toFixed(3)} {viewItem.rawItem.unit}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-ink-muted uppercase">Unit Cost</span>
                <span className="text-sm font-semibold font-mono text-ink">
                  Rs. {Number(viewItem.unitCost).toFixed(2)}
                </span>
              </div>
              <div className="border-t border-border/80 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-primary uppercase">Total Cost</span>
                <span className="text-base font-black font-mono text-primary">
                  Rs. {Number(viewItem.totalCost).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>Supplier Vendor:</span>
                <span className="font-semibold text-ink">{viewItem.supplierName || "Unspecified"}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Purchased Date & Time:</span>
                <span className="font-semibold text-ink">{new Date(viewItem.purchasedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Recorded By:</span>
                <span className="font-semibold uppercase text-ink">{viewItem.recordedBy.role.replace(/_/g, " ")}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: VIEW VENDOR BATCH ORDER */}
      <Modal
        isOpen={!!viewBatch}
        onClose={() => setViewBatch(null)}
        title={`Vendor Purchase Order — ${viewBatch?.supplierName || ""}`}
        className="max-w-xl"
        footer={
          <button
            onClick={() => setViewBatch(null)}
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-colors"
          >
            Close
          </button>
        }
      >
        {viewBatch && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-surface-sunken p-3 rounded-control border border-border text-xs">
              <div>
                <p className="font-bold text-ink">{viewBatch.supplierName}</p>
                <p className="text-ink-muted text-[11px]">{new Date(viewBatch.purchasedAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-ink-muted uppercase">Grand Total</p>
                <p className="text-sm font-black font-mono text-primary">Rs. {viewBatch.totalCost.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="text-xs font-bold text-ink-muted uppercase">Order Items ({viewBatch.items.length})</h5>
              <div className="overflow-x-auto rounded-control border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-sunken border-b border-border text-ink-muted uppercase font-bold">
                    <tr>
                      <th className="px-3 py-2">Ingredient</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Cost</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {viewBatch.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-medium">{item.rawItem.name}</td>
                        <td className="px-3 py-2 text-right font-mono">{Number(item.qty).toFixed(3)} {item.rawItem.unit}</td>
                        <td className="px-3 py-2 text-right font-mono">Rs. {Number(item.unitCost).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-primary">Rs. {Number(item.totalCost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: EDIT PURCHASE RECORD */}
      <Modal
        isOpen={!!editItem}
        onClose={() => {
          setEditItem(null);
          setEditError(null);
        }}
        title={`Edit Purchase Entry — ${editItem?.rawItem.name || ""}`}
        className="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditItem(null)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-purchase-form"
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-warning text-white text-xs font-semibold rounded-control shadow-sm hover:bg-warning/90 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </>
        }
      >
        <form id="edit-purchase-form" onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
              Raw Ingredient *
            </label>
            <SearchableSelect
              value={editRawItemId}
              onChange={(val) => setEditRawItemId(val)}
              options={rawItems.map((item) => ({
                id: item.id,
                label: `${item.name} (${item.unit})`
              }))}
              placeholder="-- Choose Ingredient --"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
              Quantity Added *
            </label>
            <input
              type="number"
              step="0.001"
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
              placeholder="e.g. 10.000"
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
              Unit Cost (NPR) *
            </label>
            <input
              type="number"
              step="0.01"
              value={editUnitCost}
              onChange={(e) => setEditUnitCost(e.target.value)}
              placeholder="e.g. 650.00"
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
              Supplier Vendor Name
            </label>
            <input
              type="text"
              value={editSupplierName}
              onChange={(e) => setEditSupplierName(e.target.value)}
              placeholder="e.g. Fresh Farms Poultry"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          {editError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {editError}
            </div>
          )}
        </form>
      </Modal>

      {/* MODAL: DELETE PURCHASE CONFIRMATION */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="Delete Purchase Record"
        className="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteItem(null)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-xs font-semibold rounded-control shadow-sm hover:bg-danger-hover disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Confirm Delete</span>
            </button>
          </>
        }
      >
        {deleteItem && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-control bg-danger/10 border border-danger/25 text-danger">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Warning: Stock Reversal</p>
                <p>
                  Deleting this purchase record will automatically deduct{" "}
                  <strong className="underline">
                    {Number(deleteItem.qty).toFixed(3)} {deleteItem.rawItem.unit}
                  </strong>{" "}
                  from <strong>{deleteItem.rawItem.name}</strong> current stock level.
                </p>
              </div>
            </div>

            <div className="text-xs text-ink-muted space-y-1 pt-1">
              <p>
                <strong>Supplier:</strong> {deleteItem.supplierName || "Unspecified"}
              </p>
              <p>
                <strong>Total Amount:</strong> Rs. {Number(deleteItem.totalCost).toFixed(2)}
              </p>
              <p>
                <strong>Recorded On:</strong> {new Date(deleteItem.purchasedAt).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 5: RECORD NEW PURCHASE */}
      <Modal
        isOpen={recordModalOpen}
        onClose={() => {
          setRecordModalOpen(false);
          setLines([{ rawItemId: "", qty: "", unitCost: "" }]);
          setSupplierName("");
          setRecordError(null);
        }}
        title="Record Raw Purchase"
        className="max-w-3xl"
        footer={
          <>
            <button
              onClick={() => {
                setRecordModalOpen(false);
                setLines([{ rawItemId: "", qty: "", unitCost: "" }]);
                setSupplierName("");
                setRecordError(null);
              }}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="purchase-form"
              disabled={recordMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {recordMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Record Log</span>
            </button>
          </>
        }
      >
        <form id="purchase-form" onSubmit={handleRecordSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
              Supplier Vendor Name
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Fresh Farms Poultry"
              className="w-full max-w-md rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div className="border-t border-border/60 pt-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-xs font-bold text-ink-muted uppercase">
                Purchase Lines
              </label>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-sunken hover:bg-border text-ink-muted text-xs font-semibold rounded-control shadow-sm border border-border transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span>Add Line</span>
              </button>
            </div>

            {/* Desktop header titles */}
            <div className="hidden md:grid md:grid-cols-12 gap-3 text-[10px] font-bold text-ink-muted uppercase mb-2 px-1">
              <div className="col-span-6">Raw Ingredient</div>
              <div className="col-span-3">Quantity Added</div>
              <div className="col-span-2">Unit Cost (NPR)</div>
              <div className="col-span-1 text-center">Action</div>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 pb-24">
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-12 gap-3 items-start border-b border-border/40 pb-3 md:pb-0 md:border-b-0">
                  <div className="col-span-12 md:col-span-6">
                    <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1 md:hidden">
                      Raw Ingredient
                    </label>
                    <SearchableSelect
                      value={line.rawItemId}
                      onChange={(val) => handleLineChange(index, "rawItemId", val)}
                      options={rawItems.map((item) => ({
                        id: item.id,
                        label: `${item.name} (${item.unit})`
                      }))}
                      placeholder="-- Choose Ingredient --"
                      required
                    />
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1 md:hidden">
                      Quantity Added
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={line.qty}
                      onChange={(e) => handleLineChange(index, "qty", e.target.value)}
                      placeholder="e.g. 10.000"
                      required
                      className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                    />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1 md:hidden">
                      Unit Cost
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.unitCost}
                      onChange={(e) => handleLineChange(index, "unitCost", e.target.value)}
                      placeholder="e.g. 650.00"
                      required
                      className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                    />
                  </div>
                  <div className="col-span-12 md:col-span-1 text-right md:text-center pt-2 md:pt-1">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(index)}
                        className="text-danger hover:text-danger/80 p-1.5 rounded-control hover:bg-danger/10 transition-colors inline-flex items-center justify-center"
                        title="Remove Line"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="h-9 w-full hidden md:block"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {recordError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {recordError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
