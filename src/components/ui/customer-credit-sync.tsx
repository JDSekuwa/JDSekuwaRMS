"use client";

import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, AlertTriangle, CheckCircle2, Loader2, Sparkles, UserCheck, Utensils, ShoppingCart, Bed } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerCreditLookupData {
  customerName: string;
  phone: string;
  totalOutstanding: number;
  isOverdue: boolean;
  activeInvoicesCount: number;
  sectionBreakdown: {
    pos: number;
    tables: number;
    rooms: number;
  };
}

interface CustomerCreditSyncProps {
  phone: string;
  onCustomerFound?: (info: { customerName: string; totalOutstanding: number; isOverdue: boolean }) => void;
  className?: string;
}

export function CustomerCreditSyncWidget({ phone, onCustomerFound, className }: CustomerCreditSyncProps) {
  const trimmedPhone = phone ? phone.trim() : "";

  const { data, isLoading } = useQuery<CustomerCreditLookupData>({
    queryKey: ["customer-credit-lookup", trimmedPhone],
    queryFn: async () => {
      const res = await fetch(`/api/credit/lookup?phone=${encodeURIComponent(trimmedPhone)}`);
      if (!res.ok) throw new Error("Credit lookup failed");
      return res.json();
    },
    enabled: trimmedPhone.length >= 3,
    staleTime: 10000,
  });

  useEffect(() => {
    if (data && data.customerName && onCustomerFound) {
      onCustomerFound({
        customerName: data.customerName,
        totalOutstanding: data.totalOutstanding,
        isOverdue: data.isOverdue,
      });
    }
  }, [data, onCustomerFound]);

  if (trimmedPhone.length < 3) return null;

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-[10px] text-ink-muted/70 p-2 rounded-control bg-surface-sunken/40 border border-border/40 animate-pulse", className)}>
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        <span>Checking accumulated credit history across POS, Tables, and Rooms...</span>
      </div>
    );
  }

  if (!data) return null;

  const hasOutstanding = data.totalOutstanding > 0;

  return (
    <div className={cn("space-y-2 rounded-card border transition-all duration-300 p-3 select-none",
      hasOutstanding
        ? data.isOverdue
          ? "bg-danger/10 border-danger/30 text-danger"
          : "bg-warning/10 border-warning/30 text-ink"
        : "bg-success/10 border-success/30 text-success",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {hasOutstanding ? (
            data.isOverdue ? (
              <AlertTriangle className="h-4 w-4 text-danger shrink-0 animate-bounce" />
            ) : (
              <CreditCard className="h-4 w-4 text-warning shrink-0" />
            )
          ) : (
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          )}
          <span className="text-[11px] font-extrabold uppercase tracking-wide">
            {hasOutstanding
              ? data.isOverdue
                ? "Overdue Credit Alert"
                : "Accumulated Credit Balance"
              : "Clear Credit Account"}
          </span>
        </div>

        {data.customerName && (
          <span className="text-[10px] font-bold opacity-80 font-mono">
            {data.customerName}
          </span>
        )}
      </div>

      {hasOutstanding ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between pt-1 border-t border-black/10 dark:border-white/10">
            <span className="text-[10px] font-bold opacity-80 uppercase">Total Debt (All Sales)</span>
            <span className="text-sm font-black tabular-nums font-mono">
              Rs. {Number(data.totalOutstanding).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Section breakdown chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {data.sectionBreakdown.pos > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 text-[9px] font-bold">
                <ShoppingCart className="h-2.5 w-2.5" />
                <span>POS: Rs. {data.sectionBreakdown.pos.toFixed(0)}</span>
              </span>
            )}
            {data.sectionBreakdown.tables > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-info/15 text-info border border-info/20 text-[9px] font-bold">
                <Utensils className="h-2.5 w-2.5" />
                <span>Tables: Rs. {data.sectionBreakdown.tables.toFixed(0)}</span>
              </span>
            )}
            {data.sectionBreakdown.rooms > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 border border-purple-500/20 text-[9px] font-bold">
                <Bed className="h-2.5 w-2.5" />
                <span>Rooms: Rs. {data.sectionBreakdown.rooms.toFixed(0)}</span>
              </span>
            )}
            <span className="text-[9px] font-semibold opacity-70 ml-auto">
              {data.activeInvoicesCount} active invoice{data.activeInvoicesCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[10px] opacity-80 font-medium">
          This customer has zero outstanding balance across all sales modules.
        </p>
      )}
    </div>
  );
}
