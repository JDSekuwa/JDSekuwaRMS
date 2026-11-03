"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  User,
  CreditCard,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Receipt,
  FileText,
  Search,
  Filter
} from "lucide-react";
import { TableOrderBillModal } from "./table-order-bill-modal";
import { cn } from "@/lib/utils";

interface TableOption {
  id: string;
  name: string;
}

interface TableOrderHistoryProps {
  tables: TableOption[];
}

interface VisitSummary {
  id: string;
  table: {
    id: string;
    name: string;
  };
  customer: {
    name: string | null;
    phone: string | null;
  };
  times: {
    openedAt: string;
    closedAt: string | null;
  };
  paymentType: "CASH" | "CREDIT" | "CARD" | null;
  totals: {
    subtotal: number;
    discount: number;
    total: number;
  };
  itemCount: number;
}

interface HistoryResponse {
  visits: VisitSummary[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export function TableOrderHistory({ tables }: TableOrderHistoryProps) {
  const [tableId, setTableId] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (tableId !== "ALL") queryParams.set("tableId", tableId);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  queryParams.set("page", page.toString());
  queryParams.set("limit", "20");

  const { data, isLoading, isFetching, refetch } = useQuery<HistoryResponse>({
    queryKey: ["table-order-history", tableId, startDate, endDate, page],
    queryFn: async () => {
      const res = await fetch(`/api/tables/history?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch table visit history");
      }
      return res.json();
    },
  });

  const formatCurrency = (val: number) =>
    `Rs. ${Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getPaymentBadge = (type: string | null) => {
    switch (type) {
      case "CASH":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/15 text-success border border-success/20">
            Cash
          </span>
        );
      case "CARD":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/20">
            Card
          </span>
        );
      case "CREDIT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-warning/15 text-warning border border-warning/20">
            Credit
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-sunken text-ink-muted">
            —
          </span>
        );
    }
  };

  const handleQuickPreset = (preset: "today" | "7days" | "all") => {
    setPage(1);
    const today = new Date().toISOString().slice(0, 10);
    if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(today);
    } else {
      setStartDate("");
      setEndDate("");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="rounded-card border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Table Selector */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="table-filter" className="text-xs font-semibold text-ink-muted">
                Table:
              </label>
              <select
                id="table-filter"
                value={tableId}
                onChange={(e) => {
                  setTableId(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-control border border-border bg-surface-sunken text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Tables</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="start-date" className="text-xs font-semibold text-ink-muted">
                From:
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1 rounded-control border border-border bg-surface-sunken text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="end-date" className="text-xs font-semibold text-ink-muted">
                To:
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1 rounded-control border border-border bg-surface-sunken text-xs font-medium text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleQuickPreset("today")}
                className="px-2 py-1 rounded-control text-[11px] font-semibold bg-surface-sunken hover:bg-border text-ink-muted transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("7days")}
                className="px-2 py-1 rounded-control text-[11px] font-semibold bg-surface-sunken hover:bg-border text-ink-muted transition-colors"
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset("all")}
                className="px-2 py-1 rounded-control text-[11px] font-semibold bg-surface-sunken hover:bg-border text-ink-muted transition-colors"
              >
                All Time
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-border bg-surface-sunken hover:bg-border text-xs font-semibold text-ink transition-all active:scale-[0.98]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Visits Table */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-sunken/80 border-b border-border text-ink-muted font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Opened</th>
                <th className="px-4 py-3">Closed</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                      <span>Loading table visit history...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && (!data?.visits || data.visits.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-ink-muted">
                    <Receipt className="h-8 w-8 mx-auto text-ink-muted/50 mb-2" />
                    <p className="font-semibold text-sm text-ink">No closed visits found</p>
                    <p className="text-xs text-ink-muted/80 mt-0.5">
                      Try adjusting the date range or table filters.
                    </p>
                  </td>
                </tr>
              )}

              {data?.visits?.map((visit) => {
                const isVoidedTable = visit.itemCount === 0;

                return (
                  <tr
                    key={visit.id}
                    onClick={() => setSelectedOrderId(visit.id)}
                    className="hover:bg-surface-sunken/60 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3 font-bold text-ink">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-control bg-primary/10 text-primary font-bold text-xs">
                        {visit.table.name}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {visit.customer.name || <span className="text-ink-muted/70 italic">Walk-in</span>}
                      </div>
                      {visit.customer.phone && (
                        <div className="text-[11px] text-ink-muted font-normal">
                          {visit.customer.phone}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateTime(visit.times.openedAt)}
                    </td>

                    <td className="px-4 py-3 text-ink font-medium">
                      {formatDateTime(visit.times.closedAt)}
                    </td>

                    <td className="px-4 py-3">
                      {getPaymentBadge(visit.paymentType)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isVoidedTable ? (
                        <span className="text-ink-muted italic">0 (Vacated)</span>
                      ) : (
                        <span className="tabular-nums font-semibold text-ink">
                          {visit.itemCount} item{visit.itemCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-bold tabular-nums text-ink">
                      {formatCurrency(visit.totals.total)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderId(visit.id);
                        }}
                        className="px-2.5 py-1 rounded-control bg-surface-sunken group-hover:bg-primary group-hover:text-white border border-border group-hover:border-primary text-ink text-[11px] font-semibold transition-colors"
                      >
                        View Bill
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-surface-sunken/40 border-t border-border flex items-center justify-between text-xs text-ink-muted">
            <div>
              Showing page <span className="font-bold text-ink">{data.pagination.page}</span> of{" "}
              <span className="font-bold text-ink">{data.pagination.totalPages}</span> (
              {data.pagination.totalCount} total visits)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={data.pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-control border border-border bg-card hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed text-ink"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-control border border-border bg-card hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed text-ink"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bill Detail Modal */}
      <TableOrderBillModal
        orderId={selectedOrderId}
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
