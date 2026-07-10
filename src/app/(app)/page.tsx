"use client";

import React, { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  Users,
  AlertTriangle,
  Bed,
  Utensils,
  CreditCard,
  RefreshCw
} from "lucide-react";

interface DashboardData {
  dailySales: {
    date: string;
    quickSales: number;
    tableSales: number;
    roomSales: number;
    totalSales: number;
  } | null;
  stockAlerts: Array<{
    id: string;
    name: string;
    unit: string;
    currentStock: number;
    minThreshold: number;
  }>;
  creditReminders: Array<{
    customerName: string;
    phone: string;
    totalOutstanding: number;
    isOverdue: boolean;
  }>;
  rooms: Array<{
    id: string;
    name: string;
    status: string;
    nightlyRate: number | null;
  }>;
  tables: Array<{
    id: string;
    name: string;
    status: string;
    currentTag: string | null;
    openOrderTotal: number | null;
  }>;
}

export default function DashboardPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Fetch dashboard data using TanStack Query
  const { data, isLoading, isError, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) {
        throw new Error("Failed to retrieve dashboard details.");
      }
      return res.json();
    }
  });

  // 2. Bind Supabase Realtime for database updates to invalidate cache
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-live-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_tables" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_orders" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_stays" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raw_items" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quick_sales" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credit_ledgers" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center text-primary">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/10 p-6 text-center max-w-md mx-auto mt-12">
        <h3 className="font-bold text-danger text-base">Dashboard Loading Failed</h3>
        <p className="text-xs text-ink-muted mt-2">Could not retrieve operational metrics from the server.</p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-danger text-white text-xs font-semibold rounded-control shadow-sm hover:bg-danger/90 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { dailySales, stockAlerts, creditReminders, rooms, tables } = data;

  // Inventory Table Columns configuration
  const stockColumns = [
    { key: "name", label: "Ingredient" },
    { key: "currentStock", label: "Current Stock", align: "right" as const, render: (val: number, row: any) => `${Number(val).toFixed(3)} ${row.unit}` },
    { key: "minThreshold", label: "Min Threshold", align: "right" as const, render: (val: number, row: any) => `${Number(val).toFixed(3)} ${row.unit}` },
    {
      key: "status",
      label: "Status",
      render: () => <StatusBadge status="OVERDUE" />
    }
  ];

  // Credit Reminders Table Columns
  const creditColumns = [
    { key: "customerName", label: "Customer Name" },
    { key: "phone", label: "Phone" },
    {
      key: "totalOutstanding",
      label: "Outstanding",
      align: "right" as const,
      render: (val: number) => `Rs. ${Number(val).toFixed(2)}`
    },
    {
      key: "status",
      label: "Status",
      render: (val: any, row: any) => <StatusBadge status={row.isOverdue ? "OVERDUE" : "PENDING"} />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description="Live status monitoring, safety stock levels, and table bookings."
        actions={
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-border border border-border text-ink-muted hover:text-ink text-xs font-semibold rounded-control transition-colors disabled:opacity-50 select-none"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* STAT CARDS ROW - ONLY RENDER FOR ADMIN+ */}
      {dailySales && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Today's Gross Sales"
            value={`Rs. ${Number(dailySales.totalSales).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingUp className="text-primary" />}
            description="Sum of POS, tables, and stays checked out today."
          />
          <StatCard
            title="POS Quick Sales"
            value={`Rs. ${Number(dailySales.quickSales).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingUp className="text-success" />}
            description="Walk-in sales settled today."
          />
          <StatCard
            title="Dine-in Table Bills"
            value={`Rs. ${Number(dailySales.tableSales).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<TrendingUp className="text-info" />}
            description="Closed restaurant table bills today."
          />
        </div>
      )}

      {/* MID-GRID TABLES: ALERTS & CREDITS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Stock Alerts Widget */}
        <div className="rounded-card border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-ink border-b border-border pb-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h3 className="font-bold text-sm">Safety Stock Alerts</h3>
          </div>
          {stockAlerts.length > 0 ? (
            <DataTable
              columns={stockColumns}
              data={stockAlerts}
              emptyMessage="No items are below minimum safety levels."
            />
          ) : (
            <div className="text-center py-6 text-ink-muted text-xs bg-surface-sunken rounded-card border border-dashed border-border">
              All raw stock quantities are currently within safe operational limits.
            </div>
          )}
        </div>

        {/* Credit Reminders Widget - ADMIN+ */}
        {role !== "WORKER" && (
          <div className="rounded-card border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-ink border-b border-border pb-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm">Credit Payment Reminders</h3>
            </div>
            {creditReminders.length > 0 ? (
              <DataTable
                columns={creditColumns}
                data={creditReminders}
                emptyMessage="No active customer outstanding credits."
              />
            ) : (
              <div className="text-center py-6 text-ink-muted text-xs bg-surface-sunken rounded-card border border-dashed border-border">
                No active outstanding customer credit ledgers pending payment.
              </div>
            )}
          </div>
        )}
      </div>

      {/* LOWER GRIDS: TABLES & ROOMS STATUS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Table Booking Status Grid */}
        <div className="rounded-card border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-ink">
              <Utensils className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm">Dine-in Tables Live Status</h3>
            </div>
            <span className="text-xs text-ink-muted font-semibold">
              {tables.filter((t) => t.status === "OCCUPIED").length} / {tables.length} Occupied
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tables.map((table) => (
              <div
                key={table.id}
                className="rounded-card border border-border bg-surface-sunken p-3.5 flex flex-col justify-between h-[105px] relative"
              >
                <div>
                  <h4 className="font-bold text-xs text-ink">{table.name}</h4>
                  {table.currentTag && (
                    <span className="text-[10px] text-ink-muted truncate block max-w-full mt-0.5">
                      {table.currentTag}
                    </span>
                  )}
                </div>
                <div className="flex items-end justify-between mt-2.5">
                  <StatusBadge status={table.status} className="text-[9px] px-1.5 py-0" />
                  {table.openOrderTotal !== null && table.openOrderTotal > 0 && (
                    <span className="text-[11px] font-bold text-primary tabular-nums">
                      Rs. {table.openOrderTotal}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rooms Status Grid */}
        <div className="rounded-card border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 text-ink">
              <Bed className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-sm">Rooms & Stays Live Status</h3>
            </div>
            <span className="text-xs text-ink-muted font-semibold">
              {rooms.filter((r) => r.status === "OCCUPIED").length} / {rooms.length} Booked
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="rounded-card border border-border bg-surface-sunken p-3.5 flex flex-col justify-between h-[105px]"
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-xs text-ink">{room.name}</h4>
                  <StatusBadge status={room.status} className="text-[9px] px-1.5 py-0" />
                </div>
                <div className="flex items-end justify-between mt-2.5">
                  <span className="text-[10px] text-ink-muted">Rate / Night</span>
                  {room.nightlyRate !== null && (
                    <span className="text-[11px] font-bold text-ink tabular-nums">
                      Rs. {Number(room.nightlyRate).toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
