"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  DollarSign, TrendingUp, Calendar, ShoppingCart, Users, Bed,
  AlertTriangle, Package, Loader2
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { cn } from "@/lib/utils";

/* ───────────────────────────── helpers ───────────────────────────── */

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function rs(n: number) {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ───────────────────────────── types ────────────────────────────── */

interface DailySales {
  date: string;
  quickSales: number;
  tableSales: number;
  roomSales: number;
  totalSales: number;
}

interface TrendPoint {
  date: string;
  quickSales: number;
  tableSales: number;
  roomSales: number;
  totalSales: number;
}

interface ItemWise {
  bestSellers: { name: string; qty: number; revenue: number }[];
  slowSellers: { name: string; qty: number; revenue: number }[];
}

interface PurchaseCost {
  totalCost: number;
  items: { name: string; qty: number; totalCost: number }[];
}

interface CreditOutstanding {
  totalOutstanding: number;
  totalOverdue: number;
  totalWrittenOff: number;
  activeCustomersCount: number;
}

interface RoomOccupancy {
  totalRooms: number;
  occupiedRoomsCount: number;
  totalNightsSold: number;
  totalRoomRevenue: number;
}

interface ProfitSummary {
  totalSales: number;
  totalPurchaseCost: number;
  grossProfit: number;
}

/* ───────────────────────── active tab type ──────────────────────── */

type ReportTab =
  | "daily"
  | "trend"
  | "items"
  | "purchases"
  | "credit"
  | "rooms"
  | "profit";

const TABS: { key: ReportTab; label: string; superOnly?: boolean }[] = [
  { key: "daily", label: "Daily Sales" },
  { key: "trend", label: "Sales Trend" },
  { key: "items", label: "Item-wise Sales" },
  { key: "purchases", label: "Purchase Costs" },
  { key: "credit", label: "Credit Outstanding" },
  { key: "rooms", label: "Room Occupancy" },
  { key: "profit", label: "Profit Summary", superOnly: true },
];

/* ═══════════════════════════ component ══════════════════════════ */

export default function ReportsPage() {
  const { role } = useAuth();
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [activeTab, setActiveTab] = useState<ReportTab>("daily");
  const [startDate, setStartDate] = useState(defaultRange().startDate);
  const [endDate, setEndDate] = useState(defaultRange().endDate);

  const params = `startDate=${startDate}&endDate=${endDate}`;

  /* ── queries ───────────────────────────────────────────────────── */

  const daily = useQuery<DailySales>({
    queryKey: ["report-daily"],
    queryFn: async () => {
      const r = await fetch("/api/reports/daily-sales");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "daily",
  });

  const trend = useQuery<TrendPoint[]>({
    queryKey: ["report-trend", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/sales-trend?${params}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "trend",
  });

  const items = useQuery<ItemWise>({
    queryKey: ["report-items", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/item-wise-sales?${params}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "items",
  });

  const purchases = useQuery<PurchaseCost>({
    queryKey: ["report-purchases", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/purchases?${params}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "purchases",
  });

  const credit = useQuery<CreditOutstanding>({
    queryKey: ["report-credit"],
    queryFn: async () => {
      const r = await fetch("/api/reports/credit-outstanding");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "credit",
  });

  const rooms = useQuery<RoomOccupancy>({
    queryKey: ["report-rooms", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/room-occupancy?${params}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "rooms",
  });

  const profit = useQuery<ProfitSummary>({
    queryKey: ["report-profit", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/profit-summary?${params}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "profit" && isSuperAdmin,
  });

  /* helpers to check loading for current tab */
  const isLoading =
    (activeTab === "daily" && daily.isLoading) ||
    (activeTab === "trend" && trend.isLoading) ||
    (activeTab === "items" && items.isLoading) ||
    (activeTab === "purchases" && purchases.isLoading) ||
    (activeTab === "credit" && credit.isLoading) ||
    (activeTab === "rooms" && rooms.isLoading) ||
    (activeTab === "profit" && profit.isLoading);

  /* ── tab needs dates? ──────────────────────────────────────────── */
  const needsDates = ["trend", "items", "purchases", "rooms", "profit"].includes(activeTab);

  /* ── filtered tabs (hide profit for non-super) ─────────────────── */
  const visibleTabs = useMemo(
    () => TABS.filter((t) => !t.superOnly || isSuperAdmin),
    [isSuperAdmin]
  );

  /* ═══════════════════════════ render ═══════════════════════════ */
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Business Analytics"
        description="Access detailed financial statements, trend visualizations, and item-level performance metrics."
      />

      {/* ── tab navigation ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "px-3.5 py-1.5 rounded-control text-xs font-semibold transition-colors select-none",
              activeTab === t.key
                ? "bg-primary text-white shadow-sm"
                : "text-ink-muted hover:bg-surface-sunken"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── date range picker ─────────────────────────────────────── */}
      {needsDates && (
        <div className="flex flex-wrap items-end gap-4 rounded-card border border-border bg-card p-4">
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-control border border-border px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-control border border-border px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* ── loading spinner ───────────────────────────────────────── */}
      {isLoading && (
        <div className="flex h-[30vh] w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* ═══════════════ TAB: Daily Sales ═══════════════ */}
      {activeTab === "daily" && daily.data && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Sales Today" value={rs(daily.data.totalSales)} icon={<DollarSign />} />
            <StatCard title="Quick-Sell Sales" value={rs(daily.data.quickSales)} icon={<ShoppingCart />} />
            <StatCard title="Table Dine-in Sales" value={rs(daily.data.tableSales)} icon={<Users />} />
            <StatCard title="Room/Stay Sales" value={rs(daily.data.roomSales)} icon={<Bed />} />
          </div>

          <div className="rounded-card border border-border bg-card p-6">
            <h4 className="text-sm font-bold text-ink mb-4">Today&apos;s Revenue Breakdown</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={[
                  { name: "Quick Sell", value: daily.data.quickSales },
                  { name: "Table", value: daily.data.tableSales },
                  { name: "Room", value: daily.data.roomSales },
                ]}
                barSize={48}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => rs(Number(v))} />
                <Bar dataKey="value" fill="#E8590C" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: Sales Trend ═══════════════ */}
      {activeTab === "trend" && trend.data && (
        <div className="rounded-card border border-border bg-card p-6 space-y-4">
          <h4 className="text-sm font-bold text-ink">Sales Trend — {startDate} to {endDate}</h4>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={trend.data}>
              <defs>
                <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E8590C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E8590C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => rs(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="totalSales" stroke="#E8590C" fill="url(#gradTotal)" name="Total" />
              <Area type="monotone" dataKey="quickSales" stroke="#2563EB" fill="none" name="Quick" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="tableSales" stroke="#16A34A" fill="none" name="Table" strokeDasharray="4 2" />
              <Area type="monotone" dataKey="roomSales" stroke="#D97706" fill="none" name="Room" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══════════════ TAB: Item-wise Sales ═══════════════ */}
      {activeTab === "items" && items.data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Best Sellers */}
          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" /> Top 5 Best Sellers
            </h4>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={items.data.bestSellers} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: any, name: any) => name === "qty" ? `${v} sold` : rs(Number(v))} />
                <Bar dataKey="qty" fill="#16A34A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Slow Sellers */}
          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Top 5 Slow Movers
            </h4>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={items.data.slowSellers} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: any, name: any) => name === "qty" ? `${v} sold` : rs(Number(v))} />
                <Bar dataKey="qty" fill="#D97706" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: Purchase Costs ═══════════════ */}
      {activeTab === "purchases" && purchases.data && (
        <div className="space-y-5">
          <StatCard title="Total Purchase Costs" value={rs(purchases.data.totalCost)} icon={<Package />} />

          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink">Cost Breakdown by Ingredient</h4>
            <ResponsiveContainer width="100%" height={Math.max(200, purchases.data.items.length * 36)}>
              <BarChart data={purchases.data.items} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip formatter={(v: any) => rs(Number(v))} />
                <Bar dataKey="totalCost" fill="#2563EB" radius={[0, 4, 4, 0]} name="Cost" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: Credit Outstanding ═══════════════ */}
      {activeTab === "credit" && credit.data && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Outstanding"
            value={rs(credit.data.totalOutstanding)}
            icon={<DollarSign />}
            description="Active unpaid credit balances"
          />
          <StatCard
            title="Overdue Amount"
            value={rs(credit.data.totalOverdue)}
            icon={<AlertTriangle />}
            description="Past due date, collection pending"
            className="border-danger/30"
          />
          <StatCard
            title="Written Off"
            value={rs(credit.data.totalWrittenOff)}
            icon={<AlertTriangle />}
            description="Bad debts permanently written off"
          />
          <StatCard
            title="Active Customers"
            value={credit.data.activeCustomersCount}
            icon={<Users />}
            description="Customers with open balances"
          />
        </div>
      )}

      {/* ═══════════════ TAB: Room Occupancy ═══════════════ */}
      {activeTab === "rooms" && rooms.data && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Rooms" value={rooms.data.totalRooms} icon={<Bed />} />
          <StatCard
            title="Currently Occupied"
            value={rooms.data.occupiedRoomsCount}
            icon={<Bed />}
            description={`${rooms.data.totalRooms > 0 ? Math.round((rooms.data.occupiedRoomsCount / rooms.data.totalRooms) * 100) : 0}% occupancy rate`}
          />
          <StatCard title="Nights Sold" value={rooms.data.totalNightsSold} icon={<Calendar />} />
          <StatCard title="Room Revenue" value={rs(rooms.data.totalRoomRevenue)} icon={<DollarSign />} />
        </div>
      )}

      {/* ═══════════════ TAB: Profit Summary (Super Admin Only) ═══════════════ */}
      {activeTab === "profit" && isSuperAdmin && profit.data && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <StatCard
              title="Total Revenue"
              value={rs(profit.data.totalSales)}
              icon={<TrendingUp />}
            />
            <StatCard
              title="Total Purchase Costs"
              value={rs(profit.data.totalPurchaseCost)}
              icon={<Package />}
            />
            <StatCard
              title="Gross Profit"
              value={rs(profit.data.grossProfit)}
              icon={<DollarSign />}
              delta={{
                value: profit.data.totalSales > 0
                  ? `${((profit.data.grossProfit / profit.data.totalSales) * 100).toFixed(1)}%`
                  : "0%",
                isPos: profit.data.grossProfit >= 0,
                label: "Gross margin",
              }}
              className={profit.data.grossProfit >= 0 ? "border-success/30" : "border-danger/30"}
            />
          </div>

          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink">Revenue vs Costs</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={[
                  { name: "Revenue", value: profit.data.totalSales },
                  { name: "Purchases", value: profit.data.totalPurchaseCost },
                  { name: "Gross Profit", value: profit.data.grossProfit },
                ]}
                barSize={56}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => rs(Number(v))} />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  fill="#E8590C"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
