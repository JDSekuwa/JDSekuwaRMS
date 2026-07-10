"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  ShoppingCart,
  Utensils,
  Bed,
  Package,
  ClipboardList,
  CreditCard,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// Sidebar item definitions with access roles
const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "ADMIN", "WORKER"] },
  { href: "/pos", label: "POS Quick Sell", icon: ShoppingCart, roles: ["SUPER_ADMIN", "ADMIN", "WORKER"] },
  { href: "/tables", label: "Table Sales", icon: Utensils, roles: ["SUPER_ADMIN", "ADMIN", "WORKER"] },
  { href: "/rooms", label: "Rooms Lodging", icon: Bed, roles: ["SUPER_ADMIN", "ADMIN", "WORKER"] },
  { href: "/inventory", label: "Inventory", icon: Package, roles: ["SUPER_ADMIN", "ADMIN", "WORKER"] },
  { href: "/purchases", label: "Purchases", icon: ClipboardList, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/credit", label: "Credit Ledger", icon: CreditCard, roles: ["SUPER_ADMIN", "ADMIN", "WORKER"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["SUPER_ADMIN", "ADMIN"] },
  { href: "/users", label: "Users Config", icon: Users, roles: ["SUPER_ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["SUPER_ADMIN", "ADMIN"] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading, signOut } = useAuth();
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-primary">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Filter navigation items by active user role
  const allowedItems = NAV_ITEMS.filter(
    (item) => !role || item.roles.includes(role)
  );

  // Get active item label for topbar title
  const activeItem = NAV_ITEMS.find((item) => {
    if (item.href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(item.href);
  });
  const pageTitle = activeItem ? activeItem.label : "RMS Portal";

  // Role Badge Styling Mapper
  const getRoleBadgeClasses = (userRole: string | null) => {
    switch (userRole) {
      case "SUPER_ADMIN":
        return "bg-danger/10 text-danger border-danger/20 dark:bg-danger/25";
      case "ADMIN":
        return "bg-info/10 text-info border-info/20 dark:bg-info/25";
      case "WORKER":
      default:
        return "bg-success/10 text-success border-success/20 dark:bg-success/25";
    }
  };

  const getRoleLabel = (userRole: string | null) => {
    switch (userRole) {
      case "SUPER_ADMIN":
        return "Super Admin";
      case "ADMIN":
        return "Admin";
      case "WORKER":
        return "Worker";
      default:
        return "Guest";
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-sunken">
      {/* SIDEBAR NAVIGATION - Hidden on mobile (<640px) */}
      <aside
        className={cn(
          "hidden sm:flex flex-col bg-sidebar border-r border-border h-full transition-all duration-300 relative select-none",
          sidebarExpanded ? "w-64" : "w-20"
        )}
      >
        {/* Sidebar Header Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 rounded-control bg-primary flex items-center justify-center text-white font-bold shrink-0 shadow-sm shadow-primary/20">
              JD
            </div>
            {sidebarExpanded && (
              <span className="font-extrabold tracking-tight text-ink whitespace-nowrap animate-fade-in text-sm uppercase">
                Sekuwa House
              </span>
            )}
          </div>
        </div>

        {/* Navigation Menu List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin">
          {allowedItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3.5 px-3 py-2.5 rounded-control text-sm font-medium transition-all group relative",
                  isActive
                    ? "bg-primary text-white shadow-sm shadow-primary/10"
                    : "text-ink-muted hover:bg-sidebar-accent hover:text-primary"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "group-hover:text-primary")} />
                {sidebarExpanded && (
                  <span className="truncate whitespace-nowrap animate-fade-in">{item.label}</span>
                )}
                {/* Tooltip on collapse */}
                {!sidebarExpanded && (
                  <div className="absolute left-full ml-3 hidden group-hover:block z-50 bg-ink text-white text-xs px-2.5 py-1.5 rounded-control shadow-md whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-border p-3 space-y-2">
          {sidebarExpanded && user && (
            <div className="px-3 py-2 overflow-hidden">
              <p className="text-xs font-semibold text-ink truncate">{user.email}</p>
              <span
                className={cn(
                  "inline-block mt-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border",
                  getRoleBadgeClasses(role)
                )}
              >
                {getRoleLabel(role)}
              </span>
            </div>
          )}
          
          <button
            onClick={signOut}
            className={cn(
              "flex w-full items-center gap-3.5 px-3 py-2.5 rounded-control text-sm font-medium text-danger hover:bg-danger/10 transition-colors group relative",
              !sidebarExpanded && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarExpanded && <span className="animate-fade-in">Sign Out</span>}
            {!sidebarExpanded && (
              <div className="absolute left-full ml-3 hidden group-hover:block z-50 bg-danger text-white text-xs px-2.5 py-1.5 rounded-control shadow-md whitespace-nowrap">
                Sign Out
              </div>
            )}
          </button>
        </div>

        {/* Sidebar Toggle Button */}
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="absolute -right-3 top-20 bg-background border border-border rounded-full p-1 shadow-md hover:bg-surface-sunken z-40 hidden md:block text-ink-muted hover:text-ink transition-colors"
        >
          {sidebarExpanded ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* TOPBAR */}
        <header className="h-16 border-b border-border bg-white flex items-center justify-between px-6 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-ink select-none">{pageTitle}</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input (Placeholder design) */}
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                placeholder="Search..."
                disabled
                className="w-full rounded-control border border-border bg-surface-sunken/80 pl-9 pr-4 py-1.5 text-xs text-ink placeholder-ink-muted/70 outline-none select-none"
              />
            </div>

            {/* Notification Bell */}
            <button className="relative p-1.5 rounded-control text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-white" />
            </button>

            {/* Role Badge (Topbar only on smaller screens / mobile layout) */}
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full border text-xs font-bold tracking-wide select-none",
                getRoleBadgeClasses(role)
              )}
            >
              {getRoleLabel(role)}
            </span>
          </div>
        </header>

        {/* CONTAINER PAGE VIEWER */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin pb-24 sm:pb-6 bg-background">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR - Visible only under 640px */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-border flex items-center justify-around px-2 z-40 shadow-lg">
        {allowedItems.slice(0, 5).map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[10px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-ink-muted hover:text-primary"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate max-w-[70px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
