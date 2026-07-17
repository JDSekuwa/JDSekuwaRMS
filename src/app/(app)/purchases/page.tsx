"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal-sheet";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Plus, Filter, Loader2, Calendar, ClipboardList } from "lucide-react";

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
    name: string;
    unit: string;
  };
  recordedBy: {
    role: string;
  };
}

export default function PurchasesPage() {
  const queryClient = useQueryClient();

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
  const [selectedRawItemId, setSelectedRawItemId] = useState("");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [recordError, setRecordError] = useState<string | null>(null);

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
    }
  });
  const purchases = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

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
      setSelectedRawItemId("");
      setQty("");
      setUnitCost("");
      setSupplierName("");
      setRecordError(null);
    },
    onError: (err: any) => {
      setRecordError(err.message || "Failed to record purchase entry");
    }
  });

  const handleRecordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRawItemId) {
      setRecordError("Please select a raw ingredient.");
      return;
    }

    const qtyNum = parseFloat(qty);
    const costNum = parseFloat(unitCost);

    if (isNaN(qtyNum) || qtyNum <= 0) {
      setRecordError("Quantity must be a positive number.");
      return;
    }

    if (isNaN(costNum) || costNum <= 0) {
      setRecordError("Unit cost must be a positive number.");
      return;
    }

    setRecordError(null);
    recordMutation.mutate({
      rawItemId: selectedRawItemId,
      qty: qtyNum,
      unitCost: costNum,
      supplierName: supplierName.trim() || undefined
    });
  };

  const handleClearFilters = () => {
    setFilterRawItemId("");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
    setPage(1);
  };

  // Table Columns
  const columns = [
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
      render: (val: string | null) => val || "-"
    },
    {
      key: "buyer",
      label: "Recorded By",
      render: (_: any, row: PurchaseRecord) => row.recordedBy.role.toLowerCase().replace(/_/g, " ")
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

      {/* FILTER CONTROL BAR */}
      <div className="rounded-card border border-border bg-card p-4 space-y-3 shadow-xs select-none">
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <Filter className="h-4 w-4 text-ink-muted" />
          <h4 className="text-xs font-bold text-ink uppercase">Filter Purchases</h4>
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
          <div className="flex justify-end pt-2">
            <button
              onClick={handleClearFilters}
              className="text-xs text-primary font-bold hover:underline"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* PURCHASES LIST TABLE */}
      {isPurchasesLoading ? (
        <div className="flex h-[30vh] w-full items-center justify-center text-primary">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <DataTable
            columns={columns}
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

      {/* MODAL 5: RECORD NEW PURCHASE */}
      <Modal
        isOpen={recordModalOpen}
        onClose={() => {
          setRecordModalOpen(false);
          setSelectedRawItemId("");
          setQty("");
          setUnitCost("");
          setSupplierName("");
          setRecordError(null);
        }}
        title="Record Raw Purchase"
        footer={
          <>
            <button
              onClick={() => setRecordModalOpen(false)}
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
              Raw Ingredient
            </label>
            <select
              value={selectedRawItemId}
              onChange={(e) => setSelectedRawItemId(e.target.value)}
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink bg-white outline-none focus:border-primary"
            >
              <option value="">-- Choose Raw Ingredient --</option>
              {rawItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
                Quantity Added
              </label>
              <input
                type="number"
                step="0.001"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 10.000"
                required
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
                Unit Cost (NPR)
              </label>
              <input
                type="number"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="e.g. 650.00"
                required
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
              Supplier Vendor Name
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. Fresh Farms Poultry"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
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
