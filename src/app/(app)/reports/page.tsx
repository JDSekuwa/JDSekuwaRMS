"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  DollarSign, TrendingUp, Calendar, ShoppingCart, Users, Bed,
  AlertTriangle, Package, Loader2, Printer
} from "lucide-react";
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

interface CogsItem {
  menuItemId: string;
  name: string;
  qty: number;
  costPerUnit: number;
  subtotalCogs: number;
}

interface CogsReport {
  totalCogs: number;
  items: CogsItem[];
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
  cogs: number;
  grossProfit: number;
  writeOffs: number;
  netProfit: number;
}

/* ───────────────────────── active tab type ──────────────────────── */

type ReportTab =
  | "daily"
  | "cogs"
  | "items"
  | "purchases"
  | "credit"
  | "rooms"
  | "profit";

const TABS: { key: ReportTab; label: string; superOnly?: boolean }[] = [
  { key: "daily", label: "Daily Sales" },
  { key: "cogs", label: "COGS" },
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

  const cogs = useQuery<CogsReport>({
    queryKey: ["report-cogs", startDate, endDate],
    queryFn: async () => {
      const r = await fetch(`/api/reports/cogs?${params}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "cogs",
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

  const creditDetails = useQuery<any>({
    queryKey: ["report-credit-details"],
    queryFn: async () => {
      const r = await fetch("/api/credit/customers?limit=100");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "credit",
  });

  const roomDetails = useQuery<any[]>({
    queryKey: ["report-room-details"],
    queryFn: async () => {
      const r = await fetch("/api/rooms");
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeTab === "rooms",
  });

  /* helpers to check loading for current tab */
  const isLoading =
    (activeTab === "daily" && daily.isLoading) ||
    (activeTab === "cogs" && cogs.isLoading) ||
    (activeTab === "items" && items.isLoading) ||
    (activeTab === "purchases" && purchases.isLoading) ||
    (activeTab === "credit" && (credit.isLoading || creditDetails.isLoading)) ||
    (activeTab === "rooms" && (rooms.isLoading || roomDetails.isLoading)) ||
    (activeTab === "profit" && profit.isLoading);

  /* ── tab needs dates? ──────────────────────────────────────────── */
  const needsDates = ["cogs", "items", "purchases", "rooms", "profit"].includes(activeTab);

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
        actions={
          <button
            onClick={() => {
              window.open(`/print-report?tab=${activeTab}&startDate=${startDate}&endDate=${endDate}`, "_blank");
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover active:scale-[0.99] transition-all select-none"
          >
            <Printer className="h-4 w-4" />
            <span>Export to PDF</span>
          </button>
        }
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

          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink border-b border-border pb-2">Today&apos;s Revenue Accounting Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4">Revenue Stream</th>
                    <th className="py-2.5 px-4 text-right">Accounting Code</th>
                    <th className="py-2.5 px-4 text-right">Amount (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2.5 px-4 font-semibold">POS Quick Sell Revenue</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">REV-QSELL</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-success">{rs(daily.data.quickSales)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold">Table Dine-in Revenue</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">REV-TDINE</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-success">{rs(daily.data.tableSales)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold">Rooms Lodging Revenue</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">REV-ROOM</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-success">{rs(daily.data.roomSales)}</td>
                  </tr>
                  <tr className="bg-surface-sunken font-bold text-sm">
                    <td className="py-3 px-4">Total Gross Receipts</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-muted">REV-TOTAL</td>
                    <td className="py-3 px-4 text-right font-mono text-primary">{rs(daily.data.totalSales)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: COGS ═══════════════ */}
      {activeTab === "cogs" && cogs.data && (
        <div className="space-y-5 animate-fade-in-up">
          <StatCard title="Total Cost of Goods Sold (COGS)" value={rs(cogs.data.totalCogs)} icon={<Package />} />

          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink border-b border-border pb-2">Cost of Goods Sold (COGS) Ledger — {startDate} to {endDate}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4">Menu Item Name</th>
                    <th className="py-2.5 px-4 text-right">Unit Recipe Cost (NPR)</th>
                    <th className="py-2.5 px-4 text-right">Quantity Sold</th>
                    <th className="py-2.5 px-4 text-right">Subtotal COGS (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cogs.data.items.map((item) => (
                    <tr key={item.menuItemId} className="hover:bg-surface-sunken/30">
                      <td className="py-2.5 px-4 font-semibold">{item.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{rs(item.costPerUnit)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{item.qty}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-danger">{rs(item.subtotalCogs)}</td>
                    </tr>
                  ))}
                  {cogs.data.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-ink-muted italic">No items sold in range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: Item-wise Sales ═══════════════ */}
      {activeTab === "items" && items.data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-fade-in-up">
          {/* Best Sellers */}
          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink border-b border-border pb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" /> Top 5 Best Sellers
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4 text-right">Quantity Sold</th>
                    <th className="py-2.5 px-4 text-right">Revenue (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.data.bestSellers.map((item, idx) => (
                    <tr key={item.name} className="hover:bg-surface-sunken/30">
                      <td className="py-2.5 px-4 text-center font-bold text-success font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-semibold">{item.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{item.qty}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-success">{rs(item.revenue)}</td>
                    </tr>
                  ))}
                  {items.data.bestSellers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-ink-muted italic">No items sold matching range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slow Sellers */}
          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink border-b border-border pb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Top 5 Slow Movers
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-4">Item Name</th>
                    <th className="py-2.5 px-4 text-right">Quantity Sold</th>
                    <th className="py-2.5 px-4 text-right">Revenue (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.data.slowSellers.map((item, idx) => (
                    <tr key={item.name} className="hover:bg-surface-sunken/30">
                      <td className="py-2.5 px-4 text-center font-bold text-warning font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-semibold">{item.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{item.qty}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-warning">{rs(item.revenue)}</td>
                    </tr>
                  ))}
                  {items.data.slowSellers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-ink-muted italic">No items sold matching range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: Purchase Costs ═══════════════ */}
      {activeTab === "purchases" && purchases.data && (
        <div className="space-y-5">
          <StatCard title="Total Purchase Costs" value={rs(purchases.data.totalCost)} icon={<Package />} />

          <div className="rounded-card border border-border bg-card p-6 space-y-4 animate-fade-in-up">
            <h4 className="text-sm font-bold text-ink border-b border-border pb-2">Acquisition Costs by Ingredient Ledger</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4">Ingredient/Supply Name</th>
                    <th className="py-2.5 px-4 text-right">Quantity Acquired</th>
                    <th className="py-2.5 px-4 text-right">Total Acquisition Cost (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchases.data.items.map((item) => (
                    <tr key={item.name} className="hover:bg-surface-sunken/30">
                      <td className="py-2.5 px-4 font-semibold">{item.name}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{Number(item.qty).toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-danger">{rs(item.totalCost)}</td>
                    </tr>
                  ))}
                  {purchases.data.items.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-ink-muted italic">No supplies acquired in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: Credit Outstanding ═══════════════ */}
      {activeTab === "credit" && credit.data && (
        <div className="space-y-5 animate-fade-in-up">
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

          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink border-b border-border pb-2">Active Accounts Receivable Ledger</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4">Debtor/Customer Name</th>
                    <th className="py-2.5 px-4 font-mono">Phone Number</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Outstanding Debt (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {creditDetails.data?.data?.map((c: any) => (
                    <tr key={c.phone} className="hover:bg-surface-sunken/30">
                      <td className="py-2.5 px-4 font-semibold">{c.customerName}</td>
                      <td className="py-2.5 px-4 font-mono">{c.phone}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-extrabold select-none",
                          c.isOverdue ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                        )}>
                          {c.isOverdue ? "OVERDUE" : "PENDING"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-danger">{rs(c.totalOutstanding)}</td>
                    </tr>
                  ))}
                  {(!creditDetails.data?.data || creditDetails.data.data.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-ink-muted italic">No active customer debts recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: Room Occupancy ═══════════════ */}
      {activeTab === "rooms" && rooms.data && (
        <div className="space-y-5 animate-fade-in-up">
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

          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink border-b border-border pb-2">Room Occupancy & Status Log</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4">Room Identifier</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Nightly Rate (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {roomDetails.data?.map((r: any) => (
                    <tr key={r.id} className="hover:bg-surface-sunken/30">
                      <td className="py-2.5 px-4 font-semibold">{r.name}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-extrabold select-none",
                          r.status === "OCCUPIED" ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
                        )}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">{rs(Number(r.nightlyRate || 0))}</td>
                    </tr>
                  ))}
                  {(!roomDetails.data || roomDetails.data.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-ink-muted italic">No rooms configured.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: Profit Summary (Super Admin Only) ═══════════════ */}
      {activeTab === "profit" && isSuperAdmin && profit.data && (
        <div className="space-y-5 animate-fade-in-up">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Revenue"
              value={rs(profit.data.totalSales)}
              icon={<TrendingUp />}
            />
            <StatCard
              title="Cost of Goods Sold (COGS)"
              value={rs(profit.data.cogs)}
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
            <StatCard
              title="Net Profit"
              value={rs(profit.data.netProfit)}
              icon={<DollarSign />}
              delta={{
                value: profit.data.totalSales > 0
                  ? `${((profit.data.netProfit / profit.data.totalSales) * 100).toFixed(1)}%`
                  : "0%",
                isPos: profit.data.netProfit >= 0,
                label: "Net margin",
              }}
              className={profit.data.netProfit >= 0 ? "border-success/30" : "border-danger/30"}
            />
          </div>

          <div className="rounded-card border border-border bg-card p-6 space-y-4">
            <h4 className="text-sm font-bold text-ink border-b border-border pb-2">Profit & Loss Income Statement Ledger — {startDate} to {endDate}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-ink">
                <thead>
                  <tr className="border-b border-border text-ink-muted/80 text-left font-bold bg-surface-sunken/40">
                    <th className="py-2.5 px-4">Financial Item Line</th>
                    <th className="py-2.5 px-4 text-right">Accounting Code</th>
                    <th className="py-2.5 px-4 text-right">Amount (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-ink">Gross Operating Revenue</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">PL-REV</td>
                    <td className="py-2.5 px-4 text-right font-mono text-success font-bold">{rs(profit.data.totalSales)}</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-ink">Cost of Goods Sold (COGS)</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">PL-COGS</td>
                    <td className="py-2.5 px-4 text-right font-mono text-danger font-bold">- {rs(profit.data.cogs)}</td>
                  </tr>
                  <tr className="bg-surface-sunken font-bold">
                    <td className="py-3 px-4">Gross Operating Profit</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-muted">PL-GPROFIT</td>
                    <td className={cn(
                      "py-3 px-4 text-right font-mono",
                      profit.data.grossProfit >= 0 ? "text-success" : "text-danger"
                    )}>
                      {rs(profit.data.grossProfit)}
                    </td>
                  </tr>
                  <tr className="font-semibold text-ink">
                    <td className="py-2.5 px-4">Gross Margin (%)</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">PL-GMARGIN</td>
                    <td className="py-2.5 px-4 text-right font-mono text-primary font-bold">
                      {profit.data.totalSales > 0
                        ? `${((profit.data.grossProfit / profit.data.totalSales) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-ink">Operating Losses (Write-offs)</td>
                    <td className="py-2.5 px-4 text-right font-mono text-ink-muted">PL-LOSS</td>
                    <td className="py-2.5 px-4 text-right font-mono text-danger font-bold">- {rs(profit.data.writeOffs)}</td>
                  </tr>
                  <tr className="bg-surface-sunken font-bold text-sm">
                    <td className="py-3 px-4">Net Profit</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-muted">PL-NPROFIT</td>
                    <td className={cn(
                      "py-3 px-4 text-right font-mono",
                      profit.data.netProfit >= 0 ? "text-success" : "text-danger"
                    )}>
                      {rs(profit.data.netProfit)}
                    </td>
                  </tr>
                  <tr className="font-bold text-sm">
                    <td className="py-3 px-4">Net Margin (%)</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-muted">PL-NMARGIN</td>
                    <td className="py-3 px-4 text-right font-mono text-primary">
                      {profit.data.totalSales > 0
                        ? `${((profit.data.netProfit / profit.data.totalSales) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
