"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/ui/stat-card";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Bed,
  Calendar,
  Loader2,
  ArrowUpDown,
  TrendingUp,
  Receipt,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalesReportResponse } from "@/services/reports.service";

export type SalesFilterPreset = "today" | "7days" | "15days" | "30days" | "custom";

function rs(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function computeFilterDates(preset: SalesFilterPreset): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();

  switch (preset) {
    case "today":
      // Today only
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

interface MonthlySalesReportProps {
  onDateRangeChange?: (startDate: string, endDate: string) => void;
}

export function MonthlySalesReport({ onDateRangeChange }: MonthlySalesReportProps) {
  const [activeFilter, setActiveFilter] = useState<SalesFilterPreset>("30days");
  const [dateRange, setDateRange] = useState(() => computeFilterDates("30days"));
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const { startDate, endDate } = dateRange;

  const handleFilterSelect = (preset: SalesFilterPreset) => {
    setActiveFilter(preset);
    if (preset !== "custom") {
      const newRange = computeFilterDates(preset);
      setDateRange(newRange);
      onDateRangeChange?.(newRange.startDate, newRange.endDate);
    }
  };

  const handleCustomDateChange = (start: string, end: string) => {
    const updated = { startDate: start, endDate: end };
    setDateRange(updated);
    onDateRangeChange?.(updated.startDate, updated.endDate);
  };

  const { data, isLoading, error } = useQuery<SalesReportResponse>({
    queryKey: ["sales-report", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load sales report");
      }
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const summary = data?.summary;
  const rawBreakdown = data?.dailyBreakdown || [];

  const sortedBreakdown = [...rawBreakdown].sort((a, b) => {
    return sortOrder === "desc"
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date);
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Filter Bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mr-1">
            Filter Period:
          </span>
          {(
            [
              { key: "today", label: "Today" },
              { key: "7days", label: "Last 7 Days" },
              { key: "15days", label: "Last 15 Days" },
              { key: "30days", label: "Last 30 Days" },
              { key: "custom", label: "Custom Range" },
            ] as const
          ).map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleFilterSelect(preset.key)}
              className={cn(
                "px-3.5 py-1.5 rounded-control text-xs font-semibold transition-all select-none",
                activeFilter === preset.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface-sunken text-ink-muted hover:text-ink hover:bg-surface-sunken/80"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom Range Picker */}
        {activeFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-2 animate-fade-in">
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleCustomDateChange(e.target.value, endDate)}
              className="rounded-control border border-border px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            />
            <span className="text-xs text-ink-muted font-medium">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleCustomDateChange(startDate, e.target.value)}
              className="rounded-control border border-border px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {/* ── Loading Spinner ───────────────────────────────────── */}
      {isLoading && (
        <div className="flex h-[30vh] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* ── Error State ───────────────────────────────────────── */}
      {error && !isLoading && (
        <div className="rounded-card border border-danger/30 bg-danger/5 p-4 text-xs font-semibold text-danger">
          {(error as Error).message}
        </div>
      )}

      {/* ── Report Content ────────────────────────────────────── */}
      {summary && !isLoading && (
        <div className="space-y-6">
          {/* 1. Primary Executive Stat Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Overall Sales"
              value={rs(summary.totalSales)}
              icon={<DollarSign />}
              description={`Gross sales (${summary.startDate} to ${summary.endDate})`}
            />
            <StatCard
              title="Overall Expenses"
              value={rs(summary.totalExpenses)}
              icon={<Receipt />}
              description="Inventory purchases & operational supplies"
              className="border-t-danger"
            />
            <StatCard
              title="Net Operating Balance"
              value={rs(summary.netProfit)}
              icon={<TrendingUp />}
              delta={{
                value: summary.totalSales > 0
                  ? `${((summary.netProfit / summary.totalSales) * 100).toFixed(1)}%`
                  : "0%",
                isPos: summary.netProfit >= 0,
                label: "Net margin",
              }}
              description="Gross sales minus operational expenses"
              className={summary.netProfit >= 0 ? "border-t-success" : "border-t-danger"}
            />
          </div>

          {/* 2. Revenue Channels Breakdown Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Quick-Sell Sales"
              value={rs(summary.quickSales)}
              icon={<ShoppingCart />}
              description="POS direct counter receipts"
            />
            <StatCard
              title="Table Dine-in Sales"
              value={rs(summary.tableSales)}
              icon={<Users />}
              description="Completed table dine-in orders"
            />
            <StatCard
              title="Room/Stay Sales"
              value={rs(summary.roomSales)}
              icon={<Bed />}
              description="Lodging & in-room stay dining"
            />
          </div>

          {/* 3. Revenue & Expense Accounting Breakdown Table */}
          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-ink">
                  Revenue & Expense Accounting Breakdown
                </h4>
                <p className="text-xs text-ink-muted mt-0.5">
                  Filtered Period: {summary.startDate} &mdash; {summary.endDate}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4">Financial Category / Stream</th>
                    <th className="py-2.5 px-4 text-right">Accounting Code</th>
                    <th className="py-2.5 px-4 text-right">Share / Ratio (%)</th>
                    <th className="py-2.5 px-4 text-right">Amount (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2.5 px-4 font-semibold">POS Quick-Sell Revenue</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">REV-QSELL</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">
                      {summary.totalSales > 0
                        ? `${((summary.quickSales / summary.totalSales) * 100).toFixed(1)}%`
                        : "0.0%"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-success">
                      {rs(summary.quickSales)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold">Table Dine-in Revenue</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">REV-TDINE</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">
                      {summary.totalSales > 0
                        ? `${((summary.tableSales / summary.totalSales) * 100).toFixed(1)}%`
                        : "0.0%"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-success">
                      {rs(summary.tableSales)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold">Rooms Lodging Revenue</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">REV-ROOM</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">
                      {summary.totalSales > 0
                        ? `${((summary.roomSales / summary.totalSales) * 100).toFixed(1)}%`
                        : "0.0%"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-success">
                      {rs(summary.roomSales)}
                    </td>
                  </tr>
                  <tr className="bg-surface-sunken/60 font-bold">
                    <td className="py-3 px-4">Total Gross Receipts</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-muted">REV-TOTAL</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-muted">100.0%</td>
                    <td className="py-3 px-4 text-right font-mono text-primary font-bold">
                      {rs(summary.totalSales)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold">Purchases & Operational Expenses</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">EXP-PURCH</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">
                      {summary.totalSales > 0
                        ? `${((summary.totalExpenses / summary.totalSales) * 100).toFixed(1)}%`
                        : "-"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-danger">
                      - {rs(summary.totalExpenses)}
                    </td>
                  </tr>
                  <tr className="bg-surface-sunken font-bold text-sm">
                    <td className="py-3 px-4">Net Operating Balance</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-muted">NET-BALANCE</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-muted">
                      {summary.totalSales > 0
                        ? `${((summary.netProfit / summary.totalSales) * 100).toFixed(1)}%`
                        : "0.0%"}
                    </td>
                    <td className={cn(
                      "py-3 px-4 text-right font-mono",
                      summary.netProfit >= 0 ? "text-success" : "text-danger"
                    )}>
                      {rs(summary.netProfit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Day-by-Day Sales & Expense Ledger */}
          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h4 className="text-sm font-bold text-ink">
                  Day-by-Day Sales & Expense Ledger
                </h4>
                <p className="text-xs text-ink-muted mt-0.5">
                  Chronological breakdown across {sortedBreakdown.length} day{sortedBreakdown.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSortOrder(prev => (prev === "desc" ? "asc" : "desc"))}
                className="flex items-center gap-1 px-3 py-1 bg-surface-sunken hover:bg-surface-sunken/80 text-ink text-xs font-semibold rounded-control transition-colors"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4 text-right">Quick Sales (NPR)</th>
                    <th className="py-2.5 px-4 text-right">Table Dine-in (NPR)</th>
                    <th className="py-2.5 px-4 text-right">Room Stays (NPR)</th>
                    <th className="py-2.5 px-4 text-right">Total Sales (NPR)</th>
                    <th className="py-2.5 px-4 text-right">Expenses (NPR)</th>
                    <th className="py-2.5 px-4 text-right">Net Balance (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedBreakdown.map((row) => {
                    const dateObj = new Date(`${row.date}T00:00:00`);
                    const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                    const hasActivity = row.totalSales > 0 || row.totalExpenses > 0;

                    return (
                      <tr
                        key={row.date}
                        className={cn(
                          "hover:bg-surface-sunken/30 transition-colors",
                          !hasActivity && "opacity-60"
                        )}
                      >
                        <td className="py-2.5 px-4 font-mono font-medium flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-ink-muted" />
                          <span>{row.date}</span>
                          <span className="text-[10px] text-ink-muted uppercase">({weekday})</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {rs(row.quickSales)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {rs(row.tableSales)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {rs(row.roomSales)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-primary">
                          {rs(row.totalSales)}
                        </td>
                        <td className={cn(
                          "py-2.5 px-4 text-right font-mono",
                          row.totalExpenses > 0 ? "text-danger font-semibold" : "text-ink-muted"
                        )}>
                          {row.totalExpenses > 0 ? `- ${rs(row.totalExpenses)}` : rs(0)}
                        </td>
                        <td className={cn(
                          "py-2.5 px-4 text-right font-mono font-bold",
                          row.netProfit > 0 ? "text-success" : row.netProfit < 0 ? "text-danger" : "text-ink"
                        )}>
                          {rs(row.netProfit)}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-ink-muted italic">
                        No sales or expense records found in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
                {sortedBreakdown.length > 0 && (
                  <tfoot>
                    <tr className="bg-surface-sunken font-bold border-t border-border">
                      <td className="py-3 px-4">Period Total</td>
                      <td className="py-3 px-4 text-right font-mono text-success">
                        {rs(summary.quickSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-success">
                        {rs(summary.tableSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-success">
                        {rs(summary.roomSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-primary text-sm">
                        {rs(summary.totalSales)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-danger text-sm">
                        - {rs(summary.totalExpenses)}
                      </td>
                      <td className={cn(
                        "py-3 px-4 text-right font-mono text-sm",
                        summary.netProfit >= 0 ? "text-success" : "text-danger"
                      )}>
                        {rs(summary.netProfit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
