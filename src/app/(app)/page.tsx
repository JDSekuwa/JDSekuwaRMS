"use client";

import React, { useEffect, useState } from "react";
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
  RefreshCw,
  CheckCircle2,
  Clock,
  Sparkles
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
    imageUrl?: string | null;
  }>;
  tables: Array<{
    id: string;
    name: string;
    status: string;
    currentTag: string | null;
    openOrderTotal: number | null;
    imageUrl?: string | null;
  }>;
}

export default function DashboardPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [greeting, setGreeting] = useState("Welcome back");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Set greeting based on Nepali local hours
  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting("शुभ प्रभात (Good Morning)");
    else if (hr < 17) setGreeting("शुभ दिन (Good Afternoon)");
    else setGreeting("शुभ सन्ध्या (Good Evening)");
  }, []);

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
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-xs font-bold text-ink-muted uppercase tracking-widest animate-pulse">Loading Operational Metrics...</span>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger/10 p-6 text-center max-w-md mx-auto mt-12 animate-fade-in-up">
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

  // Dine-in Tables metrics calculations
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
  const reservedTables = tables.filter((t) => t.status === "RESERVED").length;
  const vacantTables = tables.filter((t) => t.status === "VACANT").length;
  const totalTablesCount = tables.length;
  const tableOccupancyPercent = totalTablesCount > 0 ? Math.round((occupiedTables / totalTablesCount) * 100) : 0;
  const tableReservedPercent = totalTablesCount > 0 ? Math.round((reservedTables / totalTablesCount) * 100) : 0;
  const tableVacantPercent = totalTablesCount > 0 ? Math.round((vacantTables / totalTablesCount) * 100) : 0;

  // Rooms metrics calculations
  const occupiedRooms = rooms.filter((r) => r.status === "OCCUPIED").length;
  const vacantRooms = rooms.filter((r) => r.status === "VACANT").length;
  const totalRoomsCount = rooms.length;
  const roomOccupancyPercent = totalRoomsCount > 0 ? Math.round((occupiedRooms / totalRoomsCount) * 100) : 0;
  const roomVacantPercent = totalRoomsCount > 0 ? Math.round((vacantRooms / totalRoomsCount) * 100) : 0;

  // Custom Empty State Helper Component
  const AestheticEmptyState = ({
    icon: Icon,
    title,
    message,
    themeColor = "success"
  }: {
    icon: any;
    title: string;
    message: string;
    themeColor?: "success" | "primary" | "info";
  }) => {
    let colorClass = "text-success bg-success/10 border-success/20";
    if (themeColor === "primary") colorClass = "text-primary bg-primary/10 border-primary/20";
    if (themeColor === "info") colorClass = "text-info bg-info/10 border-info/20";

    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-card border border-dashed border-border/60 bg-surface-sunken/30">
        <div className={cn("p-3 rounded-full border mb-3 flex items-center justify-center animate-pulse-glow", colorClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <h4 className="text-xs font-bold text-ink tracking-wide mb-1 uppercase">{title}</h4>
        <p className="text-xs text-ink-muted max-w-[280px] leading-relaxed font-medium">{message}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <PageHeader
        title="Operations Dashboard"
        description={`${greeting} | Live status monitoring, safety stock levels, and table bookings.`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Live Realtime Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/15 text-success rounded-full text-[10px] font-bold tracking-wide uppercase border border-success/20 select-none shadow-xs">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
              </span>
              <span>Realtime Connected</span>
            </div>

            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-border border border-border text-ink hover:text-primary text-xs font-semibold rounded-control transition-all duration-200 disabled:opacity-50 select-none shadow-xs active:scale-[0.98]"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefetching && "animate-spin")} />
              <span>Refresh Metrics</span>
            </button>
          </div>
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
            className="animate-fade-in-up"
          />
          <StatCard
            title="POS Quick Sales"
            value={`Rs. ${Number(dailySales.quickSales).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<Sparkles className="text-success" />}
            description="Walk-in counter sales settled today."
            className="animate-fade-in-up [animation-delay:100ms]"
          />
          <StatCard
            title="Dine-in Table Bills"
            value={`Rs. ${Number(dailySales.tableSales).toLocaleString("en-NP", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<Utensils className="text-info" />}
            description="Closed restaurant table bills today."
            className="animate-fade-in-up [animation-delay:150ms]"
          />
        </div>
      )}

      {/* MID-GRID TABLES: ALERTS & CREDITS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Safety Stock Alerts Widget */}
        <div className="rounded-card border border-border bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in-up [animation-delay:200ms]">
          <div className="flex items-center gap-2 text-ink border-b border-border pb-3">
            <div className="h-8 w-8 rounded-full bg-warning/10 text-warning flex items-center justify-center">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm">Safety Stock Alerts</h3>
              <p className="text-[10px] text-ink-muted">Raw materials currently below safe thresholds</p>
            </div>
          </div>
          {stockAlerts.length > 0 ? (
            <div className="max-h-[250px] overflow-y-auto scrollbar-thin">
              <DataTable
                columns={stockColumns}
                data={stockAlerts}
                emptyMessage="No items are below minimum safety levels."
              />
            </div>
          ) : (
            <AestheticEmptyState
              icon={CheckCircle2}
              title="All Clear!"
              message="All raw stock quantities are currently within safe operational limits."
              themeColor="success"
            />
          )}
        </div>

        {/* Credit Reminders Widget - ADMIN+ */}
        {role !== "WORKER" && (
          <div className="rounded-card border border-border bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in-up [animation-delay:250ms]">
            <div className="flex items-center gap-2 text-ink border-b border-border pb-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <CreditCard className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm">Credit Payment Reminders</h3>
                <p className="text-[10px] text-ink-muted">Top overdue credit accounts requiring collection</p>
              </div>
            </div>
            {creditReminders.length > 0 ? (
              <div className="max-h-[250px] overflow-y-auto scrollbar-thin">
                <DataTable
                  columns={creditColumns}
                  data={creditReminders}
                  emptyMessage="No active customer outstanding credits."
                />
              </div>
            ) : (
              <AestheticEmptyState
                icon={CheckCircle2}
                title="No Pending Dues"
                message="All customer credit ledgers are settled or within terms."
                themeColor="primary"
              />
            )}
          </div>
        )}
      </div>

      {/* LOWER GRIDS: TABLES & ROOMS STATUS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        
        {/* Dine-in Tables Live Status Grid */}
        <div className="rounded-card border border-border bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in-up [animation-delay:300ms]">
          <div className="flex flex-col gap-2 border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Utensils className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">Dine-in Tables Live Status</h3>
                  <p className="text-[10px] text-ink-muted">Physical overview of dining floor</p>
                </div>
              </div>
              <span className="text-xs bg-surface-sunken border border-border text-ink font-bold px-2.5 py-1 rounded-full tabular-nums shadow-xs">
                {occupiedTables} / {totalTablesCount} Occupied
              </span>
            </div>

            {/* Split occupancy progress bar */}
            <div className="w-full space-y-1.5 mt-1">
              <div className="h-1.5 w-full bg-surface-sunken dark:bg-border rounded-full overflow-hidden flex">
                <div className="bg-primary h-full transition-all duration-500 ease-out" style={{ width: `${tableOccupancyPercent}%` }} />
                <div className="bg-warning h-full transition-all duration-500 ease-out" style={{ width: `${tableReservedPercent}%` }} />
                <div className="bg-success h-full transition-all duration-500 ease-out" style={{ width: `${tableVacantPercent}%` }} />
              </div>
              <div className="flex gap-4 text-[10px] font-bold text-ink-muted justify-between">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" /> {vacantTables} Vacant</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> {occupiedTables} Occupied</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> {reservedTables} Reserved</span>
              </div>
            </div>
          </div>

          {/* Tables layout grid */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
            {tables.map((table, index) => {
              const isOccupied = table.status === "OCCUPIED";
              const isReserved = table.status === "RESERVED";
              const isVacant = table.status === "VACANT";

              const ambientImages = [
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
                "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=600&q=80",
                "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80",
                "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600&q=80",
                "https://images.unsplash.com/photo-1550966871-3ed3cfd8a5d3?w=600&q=80",
                "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80",
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
              ];
              const bgImage = table.imageUrl || ambientImages[index % ambientImages.length];

              return (
                <div
                  key={table.id}
                  className="group relative rounded-card border border-border/80 p-4 flex flex-col justify-between h-[115px] transition-all duration-300 select-none overflow-hidden hover:-translate-y-1 hover:shadow-lg bg-black"
                >
                  {/* Background photo */}
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105 opacity-80"
                    style={{ backgroundImage: `url('${bgImage}')` }}
                  />

                  {/* Status-aware gradient scrim */}
                  <div className={cn(
                    "absolute inset-0 transition-opacity duration-300",
                    isOccupied
                      ? "bg-gradient-to-t from-black/95 via-black/70 to-primary/30"
                      : isReserved
                      ? "bg-gradient-to-t from-black/95 via-black/70 to-warning/30"
                      : "bg-gradient-to-t from-black/90 via-black/60 to-black/35 group-hover:from-black/85"
                  )} />

                  {/* Chairs Visual Representation */}
                  <div className="absolute top-1/2 left-1.5 -translate-y-1/2 flex flex-col gap-1.5 pointer-events-none z-10">
                    <div className={cn("h-1.5 w-1.5 rounded-full transition-all duration-300", isOccupied ? "bg-primary animate-pulse" : isReserved ? "bg-warning" : "bg-white/20")} />
                    <div className={cn("h-1.5 w-1.5 rounded-full transition-all duration-300", isOccupied ? "bg-primary animate-pulse" : isReserved ? "bg-warning" : "bg-white/20")} />
                  </div>
                  <div className="absolute top-1/2 right-1.5 -translate-y-1/2 flex flex-col gap-1.5 pointer-events-none z-10">
                    <div className={cn("h-1.5 w-1.5 rounded-full transition-all duration-300", isOccupied ? "bg-primary animate-pulse" : isReserved ? "bg-warning" : "bg-white/20")} />
                    <div className={cn("h-1.5 w-1.5 rounded-full transition-all duration-300", isOccupied ? "bg-primary animate-pulse" : isReserved ? "bg-warning" : "bg-white/20")} />
                  </div>
                  <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none z-10">
                    <div className={cn("h-1.5 w-1.5 rounded-full transition-all duration-300", isOccupied ? "bg-primary animate-pulse" : isReserved ? "bg-warning" : "bg-white/20")} />
                  </div>
                  <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none z-10">
                    <div className={cn("h-1.5 w-1.5 rounded-full transition-all duration-300", isOccupied ? "bg-primary animate-pulse" : isReserved ? "bg-warning" : "bg-white/20")} />
                  </div>

                  {/* Main Details */}
                  <div className="z-10 pl-2 pr-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-xs text-white group-hover:text-primary transition-colors">{table.name}</h4>
                      {/* Active Status indicator dot */}
                      <span className={cn(
                        "h-2 w-2 rounded-full inline-block shrink-0 shadow-xs relative",
                        isOccupied && "bg-primary",
                        isReserved && "bg-warning",
                        isVacant && "bg-success"
                      )}>
                        {isOccupied && (
                          <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 -left-0 -top-0"></span>
                        )}
                      </span>
                    </div>
                    
                    {table.currentTag ? (
                      <p className="text-[10px] text-white/70 mt-1 truncate font-bold uppercase tracking-wider max-w-[110px]" title={table.currentTag}>
                        {table.currentTag}
                      </p>
                    ) : (
                      <p className="text-[9px] text-white/40 mt-1 italic font-medium">
                        No Active Bill
                      </p>
                    )}
                  </div>

                  {/* Status Badge & Open running total */}
                  <div className="z-10 pl-2 pr-2 flex items-center justify-between border-t border-white/10 pt-1.5 mt-1.5">
                    <StatusBadge status={table.status} className="text-[8px] font-extrabold tracking-wider px-1.5 py-0" />
                    {table.openOrderTotal !== null && table.openOrderTotal > 0 && (
                      <span className="text-[10px] font-black text-white tabular-nums tracking-tight">
                        Rs. {Number(table.openOrderTotal).toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rooms Status Grid */}
        <div className="rounded-card border border-border bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300 animate-fade-in-up [animation-delay:350ms]">
          <div className="flex flex-col gap-2 border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink">
                <div className="h-8 w-8 rounded-full bg-info/10 text-info flex items-center justify-center">
                  <Bed className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">Rooms & Stays Live Status</h3>
                  <p className="text-[10px] text-ink-muted">Lodging & hospitality updates</p>
                </div>
              </div>
              <span className="text-xs bg-surface-sunken border border-border text-ink font-bold px-2.5 py-1 rounded-full tabular-nums shadow-xs">
                {occupiedRooms} / {totalRoomsCount} Booked
              </span>
            </div>

            {/* Split occupancy progress bar for Rooms */}
            <div className="w-full space-y-1.5 mt-1">
              <div className="h-1.5 w-full bg-surface-sunken dark:bg-border rounded-full overflow-hidden flex">
                <div className="bg-info h-full transition-all duration-500 ease-out" style={{ width: `${roomOccupancyPercent}%` }} />
                <div className="bg-success h-full transition-all duration-500 ease-out" style={{ width: `${roomVacantPercent}%` }} />
              </div>
              <div className="flex gap-4 text-[10px] font-bold text-ink-muted justify-between">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-success" /> {vacantRooms} Vacant Stays</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-info" /> {occupiedRooms} Active Lodging</span>
              </div>
            </div>
          </div>

          {/* Rooms List Grid */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
            {rooms.map((room, index) => {
              const isOccupied = room.status === "OCCUPIED";
              const isVacant = room.status === "VACANT";

              const hotelImages = [
                "https://images.unsplash.com/photo-1611891487122-2075b962442f?w=600&q=80",
                "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80",
                "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600&q=80",
                "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600&q=80",
                "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80",
                "https://images.unsplash.com/photo-1540518614846-7eded433c457?w=600&q=80",
              ];
              const bgImage = room.imageUrl || hotelImages[index % hotelImages.length];

              return (
                <div
                  key={room.id}
                  className="group relative rounded-card border border-border/80 p-4 flex flex-col justify-between h-[115px] transition-all duration-300 select-none overflow-hidden hover:-translate-y-1 hover:shadow-lg bg-black"
                >
                  {/* Background photo */}
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105 opacity-80"
                    style={{ backgroundImage: `url('${bgImage}')` }}
                  />

                  {/* Status-aware gradient scrim */}
                  <div className={cn(
                    "absolute inset-0 transition-opacity duration-300",
                    isOccupied
                      ? "bg-gradient-to-t from-black/95 via-black/70 to-info/30"
                      : "bg-gradient-to-t from-black/90 via-black/60 to-black/35 group-hover:from-black/85"
                  )} />

                  {/* Decorative faint background icon */}
                  <div className="absolute -right-2.5 -bottom-2.5 text-white/5 opacity-[0.03] transform -rotate-12 pointer-events-none group-hover:scale-110 transition-transform duration-300 z-10">
                    <Bed className="h-14 w-14" />
                  </div>

                  {/* Main Details */}
                  <div className="z-10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bed className={cn("h-4 w-4 shrink-0 transition-colors duration-300", isOccupied ? "text-info" : "text-white/30")} />
                        <h4 className="font-extrabold text-xs text-white">{room.name}</h4>
                      </div>
                      <span className={cn(
                        "h-2 w-2 rounded-full inline-block shrink-0 shadow-xs",
                        isOccupied && "bg-info",
                        isVacant && "bg-success"
                      )} />
                    </div>
                    
                    {isOccupied ? (
                      <p className="text-[10px] text-info font-bold mt-2 flex items-center gap-1 select-none">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-info animate-pulse" />
                        Guest Boarded Stay
                      </p>
                    ) : (
                      <p className="text-[9px] text-white/55 mt-2 italic font-medium">
                        Vacant & Cleaned
                      </p>
                    )}
                  </div>

                  {/* Room checkout rates */}
                  <div className="flex items-center justify-between border-t border-white/10 pt-1.5 mt-1.5 z-10">
                    <StatusBadge status={room.status} className="text-[8px] font-extrabold tracking-wider px-1.5 py-0" />
                    {room.nightlyRate !== null && (
                      <div className="text-right">
                        <span className="text-[10px] font-extrabold text-white tabular-nums tracking-tight">
                          Rs. {Number(room.nightlyRate).toFixed(0)} <span className="text-[8px] text-white/70 font-normal font-sans">/ night</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
