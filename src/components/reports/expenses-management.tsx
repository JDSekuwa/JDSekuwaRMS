"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal-sheet";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  DollarSign,
  Receipt,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Search,
  Filter,
  Loader2,
  FolderPlus,
  AlertCircle,
  HelpCircle,
  Building,
  CreditCard,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PaymentType } from "@/generated/prisma/enums";

export type ExpenseFilterPreset = "today" | "7days" | "15days" | "30days" | "custom";

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  _count?: {
    expenses: number;
  };
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number | string;
  date: string;
  paymentType: PaymentType;
  vendor: string | null;
  notes: string | null;
  categoryId: string;
  category: {
    id: string;
    name: string;
  };
  recordedBy: {
    id: string;
    username: string;
    role: string;
  };
  createdAt: string;
}

export interface ExpenseListResponse {
  data: ExpenseItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalAmount: number;
  };
}

function rs(n: number | string): string {
  const num = typeof n === "number" ? n : Number(n) || 0;
  return `Rs. ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeFilterDates(preset: ExpenseFilterPreset): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "today":
      break;
    case "7days":
      start.setDate(end.getDate() - 6);
      break;
    case "15days":
      start.setDate(end.getDate() - 14);
      break;
    case "30days":
    case "custom":
    default:
      start.setDate(end.getDate() - 29);
      break;
  }

  const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: toYMD(start),
    endDate: toYMD(end),
  };
}

const PAYMENT_OPTIONS: { value: "CASH" | "CARD" | "CREDIT"; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card / Digital (FonePay / Bank)" },
  { value: "CREDIT", label: "Credit / Udharo" },
];

export function ExpensesManagement() {
  const queryClient = useQueryClient();

  // Filter states
  const [activePreset, setActivePreset] = useState<ExpenseFilterPreset>("30days");
  const [dateRange, setDateRange] = useState(() => computeFilterDates("30days"));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // Modal States
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; count: number } | null>(null);

  // Selected item for edit or delete
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);

  // Form states for Create / Edit Expense
  const [formTitle, setFormTitle] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formPaymentType, setFormPaymentType] = useState<PaymentType>(PaymentType.CASH);
  const [formVendor, setFormVendor] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");

  // Category Manager Form State
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [catError, setCatError] = useState("");

  // 1. Fetch Categories
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<ExpenseCategory[]>({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await fetch("/api/expenses/categories");
      if (!res.ok) throw new Error("Failed to load expense categories");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch Expenses with current filters
  const { startDate, endDate } = dateRange;
  const {
    data: expenseData,
    isLoading: isLoadingExpenses,
    isFetching,
    error: expenseError,
  } = useQuery<ExpenseListResponse>({
    queryKey: ["expenses-list", startDate, endDate, selectedCategoryId, searchQuery, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        page: String(page),
        limit: String(limit),
      });
      if (selectedCategoryId) params.append("categoryId", selectedCategoryId);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/expenses?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load expenses");
      }
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  // Handlers for Preset Dates
  const handlePresetChange = (preset: ExpenseFilterPreset) => {
    setActivePreset(preset);
    setPage(1);
    if (preset !== "custom") {
      setDateRange(computeFilterDates(preset));
    }
  };

  // Reset form
  const resetExpenseForm = () => {
    setFormTitle("");
    setFormCategoryId(categories[0]?.id || "");
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormPaymentType(PaymentType.CASH);
    setFormVendor("");
    setFormNotes("");
    setFormError("");
    setSelectedExpense(null);
  };

  // Open Create Modal
  const openCreateModal = () => {
    resetExpenseForm();
    if (categories.length > 0 && !formCategoryId) {
      setFormCategoryId(categories[0].id);
    }
    setIsRecordModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (expense: ExpenseItem) => {
    setSelectedExpense(expense);
    setFormTitle(expense.title);
    setFormCategoryId(expense.categoryId);
    setFormAmount(String(expense.amount));
    setFormDate(expense.date.split("T")[0]);
    setFormPaymentType(expense.paymentType);
    setFormVendor(expense.vendor || "");
    setFormNotes(expense.notes || "");
    setFormError("");
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (expense: ExpenseItem) => {
    setSelectedExpense(expense);
    setIsDeleteModalOpen(true);
  };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(formAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Amount must be a positive number");
      }
      if (!formTitle.trim()) {
        throw new Error("Title is required");
      }
      if (!formCategoryId) {
        throw new Error("Category is required");
      }

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          categoryId: formCategoryId,
          amount: parsedAmount,
          date: formDate,
          paymentType: formPaymentType,
          vendor: formVendor.trim() || undefined,
          notes: formNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to record expense");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["sales-report"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setIsRecordModalOpen(false);
      resetExpenseForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "An unexpected error occurred");
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExpense) return;
      const parsedAmount = parseFloat(formAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Amount must be a positive number");
      }
      if (!formTitle.trim()) {
        throw new Error("Title is required");
      }

      const res = await fetch(`/api/expenses/${selectedExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          categoryId: formCategoryId,
          amount: parsedAmount,
          date: formDate,
          paymentType: formPaymentType,
          vendor: formVendor.trim() || null,
          notes: formNotes.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update expense");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["sales-report"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setIsEditModalOpen(false);
      resetExpenseForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "An unexpected error occurred");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExpense) return;
      const res = await fetch(`/api/expenses/${selectedExpense.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete expense");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["sales-report"] });
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setIsDeleteModalOpen(false);
      setSelectedExpense(null);
    },
  });

  // Create Category Mutation
  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!newCatName.trim()) {
        throw new Error("Category name is required");
      }
      const res = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCatName.trim(),
          description: newCatDesc.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create category");
      }
      return res.json();
    },
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setNewCatName("");
      setNewCatDesc("");
      setCatError("");
      if (!formCategoryId) {
        setFormCategoryId(newCat.id);
      }
    },
    onError: (err: any) => {
      setCatError(err.message || "Failed to create category");
    },
  });

  // Delete Category Mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (catId: string) => {
      const res = await fetch(`/api/expenses/categories/${catId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete category");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-list"] });
      queryClient.invalidateQueries({ queryKey: ["sales-report"] });
      setCategoryToDelete(null);
    },
    onError: (err: any) => {
      setCatError(err.message || "Failed to delete category");
    },
  });

  const totalExpenseAmount = expenseData?.summary?.totalAmount || 0;
  const totalCount = expenseData?.pagination?.total || 0;
  const avgExpense = totalCount > 0 ? totalExpenseAmount / totalCount : 0;

  return (
    <div className="space-y-6">
      {/* ── PRESET FILTER BAR ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted mr-1">
            Period:
          </span>
          {(
            [
              { key: "today", label: "Today" },
              { key: "7days", label: "Last 7 Days" },
              { key: "15days", label: "Last 15 Days" },
              { key: "30days", label: "Last 30 Days" },
              { key: "custom", label: "Custom Range" },
            ] as const
          ).map((preset) => {
            const isActive = activePreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handlePresetChange(preset.key)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150",
                  isActive
                    ? "bg-primary text-white shadow-xs"
                    : "bg-surface-sunken text-ink-muted hover:bg-surface-hover hover:text-ink"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Action Buttons: Add Category & Record Expense */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCatError("");
              setIsCategoryModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-ink hover:bg-surface-hover transition-colors shadow-xs"
          >
            <FolderPlus className="h-4 w-4 text-ink-muted" />
            <span>Manage Categories</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Custom Date Pickers (visible only when custom range is selected) */}
      {activePreset === "custom" && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-medium text-ink">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Start Date:</span>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => {
                setDateRange((prev) => ({ ...prev, startDate: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-ink">
            <Calendar className="h-4 w-4 text-primary" />
            <span>End Date:</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => {
                setDateRange((prev) => ({ ...prev, endDate: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      )}

      {/* ── FILTER / SEARCH BAR ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
          <input
            type="text"
            placeholder="Search by title, vendor, or notes..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-border bg-surface-sunken pl-9 pr-4 py-2 text-xs text-ink placeholder:text-ink-muted focus:bg-card focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Category Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-ink-muted" />
          <select
            value={selectedCategoryId}
            onChange={(e) => {
              setSelectedCategoryId(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── EXPENSES DATA TABLE ────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-sunken/40">
          <div>
            <h3 className="text-sm font-bold text-ink">Operational Expense Ledger</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Non-saleable overhead expenses (wires, soap, utensils, repairs, cleaning supplies, bills)
            </p>
          </div>
          {isFetching && (
            <div className="flex items-center gap-2 text-xs text-primary font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Updating...</span>
            </div>
          )}
        </div>

        {isLoadingExpenses ? (
          <div className="flex flex-col items-center justify-center p-12 text-ink-muted gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs">Loading operational expenses...</p>
          </div>
        ) : expenseError ? (
          <div className="flex items-center justify-center p-12 text-center text-xs text-red-600 gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>{(expenseError as Error).message || "Failed to load expenses"}</span>
          </div>
        ) : !expenseData || expenseData.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-ink-muted space-y-3">
            <Receipt className="h-10 w-10 text-ink-muted/40 stroke-1" />
            <div>
              <p className="text-sm font-bold text-ink">No Expenses Found</p>
              <p className="text-xs text-ink-muted mt-1">
                No non-saleable expense entries match your selected date range or search filter.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              <span>Record First Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-sunken/70 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Title / Description</th>
                  <th className="px-6 py-3 font-semibold">Category</th>
                  <th className="px-6 py-3 font-semibold">Payment Mode</th>
                  <th className="px-6 py-3 font-semibold">Vendor / Payee</th>
                  <th className="px-6 py-3 font-semibold">Recorded By</th>
                  <th className="px-6 py-3 font-semibold text-right">Amount (NPR)</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenseData.data.map((item) => {
                  const dateStr = item.date ? item.date.split("T")[0] : "-";
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-surface-hover/60"
                    >
                      <td className="px-6 py-3.5 font-mono text-ink whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-6 py-3.5 text-ink">
                        <div className="font-semibold text-ink">{item.title}</div>
                        {item.notes && (
                          <div className="text-[11px] text-ink-muted mt-0.5 max-w-xs truncate" title={item.notes}>
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-0.5 text-[11px] font-medium text-ink-muted border border-border">
                          {item.category?.name || "Uncategorized"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap font-mono text-[11px] text-ink-muted">
                        <span className="rounded-md bg-surface-sunken px-2 py-0.5 border border-border">
                          {item.paymentType}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-ink-muted whitespace-nowrap">
                        {item.vendor || "-"}
                      </td>
                      <td className="px-6 py-3.5 text-ink-muted whitespace-nowrap">
                        <div className="text-ink font-medium">{item.recordedBy?.username || "Admin"}</div>
                        <div className="text-[10px] text-ink-muted">{item.recordedBy?.role}</div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-bold text-red-600 whitespace-nowrap">
                        {rs(item.amount)}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
                            title="Edit Expense"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(item)}
                            className="rounded-md p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete Expense"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {expenseData && expenseData.pagination.totalPages > 1 && (
          <div className="border-t border-border px-6 py-3">
            <PaginationControls
              currentPage={page}
              totalPages={expenseData.pagination.totalPages}
              totalItems={expenseData.pagination.total}
              limit={limit}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          CREATE / EDIT EXPENSE MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isRecordModalOpen || isEditModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setIsEditModalOpen(false);
          resetExpenseForm();
        }}
        title={isEditModalOpen ? "Edit Operational Expense" : "Record Non-Saleable Expense"}
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsRecordModalOpen(false);
                setIsEditModalOpen(false);
                resetExpenseForm();
              }}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                if (isEditModalOpen) {
                  updateMutation.mutate();
                } else {
                  createMutation.mutate();
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <span>{isEditModalOpen ? "Update Expense" : "Save Expense"}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 py-2 text-xs">
          {formError && (
            <div className="rounded-lg bg-red-50 p-3 text-red-700 border border-red-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block font-semibold text-ink mb-1">
              Title / Expense Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Electrical wire, Hand soap, Utensil cleaning liquid, Bulb"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Category & Amount in 2 cols */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-ink">
                  Category <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  + New Category
                </button>
              </div>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="" disabled>
                  Select Category
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">
                Amount (NPR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono font-bold text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Date & Payment Type */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-ink mb-1">
                Expense Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-mono text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block font-semibold text-ink mb-1">
                Payment Method
              </label>
              <select
                value={formPaymentType}
                onChange={(e) => setFormPaymentType(e.target.value as PaymentType)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                {PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label className="block font-semibold text-ink mb-1">
              Vendor / Payee / Store Name
            </label>
            <input
              type="text"
              placeholder="e.g. Bhandari Hardware, Patan Plastic Traders"
              value={formVendor}
              onChange={(e) => setFormVendor(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-ink mb-1">
              Remarks / Purpose / Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Installed in Room 102 bathroom; 2 rolls of electrical wire"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          DELETE CONFIRMATION MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedExpense(null);
        }}
        title="Delete Expense Entry"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedExpense(null);
              }}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Confirm Delete</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3 py-2 text-xs text-ink">
          <p>
            Are you sure you want to delete this expense record? This action will permanently remove it from the ledger and adjust the reports.
          </p>
          {selectedExpense && (
            <div className="rounded-lg border border-border bg-surface-sunken p-3 space-y-1">
              <div className="font-bold text-ink">{selectedExpense.title}</div>
              <div className="text-ink-muted">
                Category: <span className="text-ink font-medium">{selectedExpense.category?.name}</span>
              </div>
              <div className="text-ink-muted">
                Amount: <span className="font-mono font-bold text-red-600">{rs(selectedExpense.amount)}</span>
              </div>
              <div className="text-ink-muted">
                Date: <span className="font-mono text-ink">{selectedExpense.date.split("T")[0]}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          CATEGORY MANAGER MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setCatError("");
          setNewCatName("");
          setNewCatDesc("");
        }}
        title="Manage Expense Categories"
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setIsCategoryModalOpen(false);
                setCatError("");
              }}
              className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-hover"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="space-y-5 py-2 text-xs">
          {catError && (
            <div className="rounded-lg bg-red-50 p-2.5 text-red-700 border border-red-200 text-xs">
              {catError}
            </div>
          )}

          {/* Add Category Form */}
          <div className="rounded-lg border border-border bg-surface-sunken/60 p-3.5 space-y-3">
            <div className="font-bold text-ink">Create New Category</div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Category name (e.g. Electrical, Sanitary, Stationery)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="text"
                placeholder="Optional description / details"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-ink focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                disabled={createCategoryMutation.isPending || !newCatName.trim()}
                onClick={() => createCategoryMutation.mutate()}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {createCategoryMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Add Category</span>
              </button>
            </div>
          </div>

          {/* Existing Categories List */}
          <div>
            <div className="font-bold text-ink mb-2">Existing Categories ({categories.length})</div>
            <div className="max-h-60 overflow-y-auto divide-y divide-border rounded-lg border border-border">
              {categories.map((c) => {
                const count = c._count?.expenses || 0;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 hover:bg-surface-hover/50"
                  >
                    <div>
                      <div className="font-semibold text-ink">{c.name}</div>
                      {c.description && (
                        <div className="text-[11px] text-ink-muted">{c.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-mono text-ink-muted border border-border">
                        {count} {count === 1 ? "expense" : "expenses"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoryToDelete({ id: c.id, name: c.name, count })}
                        disabled={deleteCategoryMutation.isPending}
                        className="rounded-md p-1 text-ink-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          CATEGORY DELETE CONFIRMATION MODAL (RESTRICT POLICY)
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        title="Delete Expense Category"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCategoryToDelete(null)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-hover"
            >
              {categoryToDelete && categoryToDelete.count > 0 ? "Close" : "Cancel"}
            </button>
            {categoryToDelete && categoryToDelete.count === 0 && (
              <button
                type="button"
                disabled={deleteCategoryMutation.isPending}
                onClick={() => {
                  if (categoryToDelete) {
                    deleteCategoryMutation.mutate(categoryToDelete.id);
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteCategoryMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Delete Category</span>
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-3 py-2 text-xs">
          {categoryToDelete && categoryToDelete.count > 0 ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-red-900">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>Deletion Restricted</span>
              </div>
              <p className="text-[11px] leading-relaxed text-red-700">
                Category <strong>"{categoryToDelete.name}"</strong> cannot be deleted because it is currently linked to{" "}
                <strong>{categoryToDelete.count} {categoryToDelete.count === 1 ? "expense record" : "expense records"}</strong>.
              </p>
              <p className="text-[11px] text-red-600">
                To protect accounting integrity, please reassign or delete the associated expense records before removing this category.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-ink">
                Are you sure you want to delete category{" "}
                <span className="font-bold">"{categoryToDelete?.name}"</span>?
              </p>
              <p className="text-ink-muted">
                This category has 0 expenses linked. This action cannot be undone.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
