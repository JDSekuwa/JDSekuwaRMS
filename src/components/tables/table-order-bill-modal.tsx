"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal-sheet";
import {
  Utensils,
  Clock,
  User,
  Phone,
  CreditCard,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle,
  XCircle,
  Receipt
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TableOrderBillModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface OrderItemDetail {
  id: string;
  item: string;
  menuItemId: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  isVoid: boolean;
  createdAt: string;
}

interface RoundDetail {
  round: number;
  roundLabel: string;
  items: OrderItemDetail[];
}

interface VisitDetailResponse {
  id: string;
  status: string;
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
  openedBy: {
    id: string;
    role: string;
  } | null;
  rounds: RoundDetail[];
}

export function TableOrderBillModal({
  orderId,
  isOpen,
  onClose,
}: TableOrderBillModalProps) {
  const { data, isLoading, isError, error } = useQuery<VisitDetailResponse>({
    queryKey: ["table-order-history-detail", orderId],
    queryFn: async () => {
      if (!orderId) throw new Error("No order selected");
      const res = await fetch(`/api/tables/history/${orderId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load visit bill detail");
      }
      return res.json();
    },
    enabled: isOpen && !!orderId,
  });

  const formatCurrency = (val: number) => `Rs. ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-success/15 text-success border border-success/20">Cash</span>;
      case "CARD":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary border border-primary/20">Card</span>;
      case "CREDIT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/20">Credit</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-sunken text-ink-muted">Unknown</span>;
    }
  };

  const allItemsCount = data?.rounds?.reduce((sum, r) => sum + r.items.length, 0) ?? 0;
  const activeItemsCount = data?.rounds?.reduce((sum, r) => sum + r.items.filter(i => !i.isVoid).length, 0) ?? 0;
  const voidedItemsCount = allItemsCount - activeItemsCount;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={data ? `${data.table.name} — Visit Bill` : "Visit Bill Detail"}
      className="max-w-xl"
    >
      <div className="p-6 space-y-6">
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-ink-muted">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-xs font-medium">Loading visit details...</p>
          </div>
        )}

        {isError && (
          <div className="p-4 rounded-card bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to load bill</p>
              <p className="text-xs opacity-90">{(error as any)?.message || "Internal server error"}</p>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Header / Summary Card */}
            <div className="rounded-card border border-border bg-surface-sunken/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-control bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {data.table.name}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-ink">{data.table.name}</h3>
                    <p className="text-[11px] text-ink-muted">
                      Closed Bill • Status: <span className="font-semibold text-success uppercase">{data.status}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getPaymentBadge(data.paymentType)}
                </div>
              </div>

              {/* Customer & Timestamps Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Customer</span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-ink font-medium">
                    <User className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                    <span>{data.customer.name || "Walk-in Guest"}</span>
                  </div>
                  {data.customer.phone && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-ink-muted text-[11px]">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{data.customer.phone}</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">Timestamps</span>
                  <div className="flex items-center gap-1.5 mt-0.5 text-ink-muted text-[11px]">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                    <span>Opened: {formatDateTime(data.times.openedAt)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-ink font-medium">
                    <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                    <span>Closed: {formatDateTime(data.times.closedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Empty Visit / Voided Table Warning */}
            {allItemsCount === 0 && (
              <div className="p-4 rounded-card bg-surface-sunken border border-border text-center space-y-1">
                <p className="font-semibold text-xs text-ink">No items ordered</p>
                <p className="text-[11px] text-ink-muted">
                  This table visit was vacated or closed without any food/drink orders.
                </p>
              </div>
            )}

            {/* Rounds List */}
            {data.rounds && data.rounds.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-ink-muted">
                    Order Rounds ({data.rounds.length})
                  </h4>
                  {voidedItemsCount > 0 && (
                    <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                      {voidedItemsCount} item{voidedItemsCount > 1 ? "s" : ""} voided
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {data.rounds.map((round) => (
                    <div
                      key={round.round}
                      className="rounded-card border border-border bg-card overflow-hidden"
                    >
                      {/* Round Header */}
                      <div className="bg-surface-sunken/60 px-3.5 py-2 border-b border-border flex items-center justify-between text-xs font-bold text-ink">
                        <div className="flex items-center gap-1.5">
                          <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">
                            {round.round}
                          </span>
                          <span>{round.roundLabel}</span>
                        </div>
                        <span className="text-[10px] font-normal text-ink-muted">
                          {round.items.length} item{round.items.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Items in this round */}
                      <div className="divide-y divide-border/60">
                        {round.items.map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              "px-3.5 py-2.5 flex items-center justify-between text-xs gap-3 transition-colors",
                              item.isVoid && "bg-destructive/[0.03] opacity-60"
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "font-semibold truncate text-ink",
                                    item.isVoid && "line-through text-ink-muted"
                                  )}
                                >
                                  {item.item}
                                </span>
                                {item.isVoid && (
                                  <span className="shrink-0 text-[9px] font-bold text-destructive uppercase px-1.5 py-0.2 rounded bg-destructive/10 border border-destructive/20">
                                    Voided
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-ink-muted mt-0.5">
                                {formatCurrency(item.unitPrice)} × {item.qty}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={cn(
                                  "font-bold tabular-nums text-ink",
                                  item.isVoid && "line-through text-ink-muted"
                                )}
                              >
                                {formatCurrency(item.lineTotal)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bill Summary / Totals */}
            <div className="rounded-card border border-border bg-surface-sunken/30 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>Subtotal</span>
                <span className="tabular-nums font-medium text-ink">
                  {formatCurrency(data.totals.subtotal)}
                </span>
              </div>

              {Number(data.totals.discount) > 0 && (
                <div className="flex justify-between text-success">
                  <span>Discount Applied</span>
                  <span className="tabular-nums font-medium">
                    - {formatCurrency(data.totals.discount)}
                  </span>
                </div>
              )}

              <div className="border-t border-border pt-2 flex justify-between items-baseline font-bold text-sm">
                <span className="text-ink">Net Total</span>
                <span className="text-primary text-base tabular-nums">
                  {formatCurrency(data.totals.total)}
                </span>
              </div>

              <div className="pt-2 flex justify-between items-center text-[11px] text-ink-muted border-t border-border/50">
                <span>Payment Method</span>
                <span className="font-semibold text-ink">{data.paymentType || "None"}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
