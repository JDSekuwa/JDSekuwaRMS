"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal-sheet";
import { CreditCard, History, Plus, Scale, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerSummary {
  customerName: string;
  phone: string;
  totalOutstanding: number;
  isOverdue: boolean;
}

interface PaymentRecord {
  id: string;
  amount: number;
  paidAt: string;
}

interface CreditLedgerEntry {
  id: string;
  customerName: string;
  phone: string;
  source: "QUICK_SELL" | "TABLE_SALE" | "ROOM_STAY";
  amount: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "WRITTEN_OFF";
  dueDate: string;
  givenDate: string;
  payments: PaymentRecord[];
}

export default function CreditPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  // Selected customer details
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");

  // Payment modal parameters
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // 1. Fetch outstanding credit customer summaries list
  const { data: customers = [], isLoading: isCustLoading } = useQuery<CustomerSummary[]>({
    queryKey: ["credit-customers"],
    queryFn: async () => {
      const res = await fetch("/api/credit/customers");
      if (!res.ok) throw new Error("Failed to load credit customer summaries");
      return res.json();
    }
  });

  // 2. Fetch passbook details for selected customer phone
  const { data: passbook = [], isLoading: isPassbookLoading, refetch: refetchPassbook } = useQuery<CreditLedgerEntry[]>({
    queryKey: ["credit-passbook", selectedPhone],
    queryFn: async () => {
      const res = await fetch(`/api/credit/customer/${selectedPhone}`);
      if (!res.ok) throw new Error("Failed to load customer passbook history");
      return res.json();
    },
    enabled: !!selectedPhone
  });

  // 3. Mutation: Record credit payment
  const paymentMutation = useMutation({
    mutationFn: async ({ ledgerId, amount }: { ledgerId: string; amount: number }) => {
      const res = await fetch(`/api/credit/${ledgerId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Payment recording failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      refetchPassbook();
      setPaymentModalOpen(false);
      setSelectedLedgerId(null);
      setPaymentAmount("");
      setPaymentError(null);
    },
    onError: (err: any) => {
      setPaymentError(err.message || "Failed to record payment");
    }
  });

  // 4. Mutation: Write off credit entry (Admin only)
  const writeOffMutation = useMutation({
    mutationFn: async (ledgerId: string) => {
      const res = await fetch(`/api/credit/${ledgerId}/write-off`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Write off failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      refetchPassbook();
    }
  });

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedgerId) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setPaymentError("Please enter a valid positive payment amount.");
      return;
    }

    // Check outstanding amount to avoid overpayment
    const ledger = passbook.find((l) => l.id === selectedLedgerId);
    if (ledger) {
      const totalPaid = ledger.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const outstanding = Number(ledger.amount) - totalPaid;
      if (amount > outstanding) {
        setPaymentError(`Entered amount exceeds remaining outstanding balance of Rs. ${outstanding.toFixed(2)}.`);
        return;
      }
    }

    setPaymentError(null);
    paymentMutation.mutate({
      ledgerId: selectedLedgerId,
      amount
    });
  };

  const handleWriteOff = (ledgerId: string, amount: number) => {
    if (!isAdmin) return;
    if (confirm(`Are you sure you want to write off the credit outstanding of Rs. ${amount.toFixed(2)}? This action is irreversible.`)) {
      writeOffMutation.mutate(ledgerId);
    }
  };

  // Summaries Columns
  const summaryColumns = [
    { key: "customerName", label: "Customer Name", sortable: true },
    { key: "phone", label: "Phone Number" },
    {
      key: "totalOutstanding",
      label: "Outstanding Due",
      align: "right" as const,
      render: (val: number) => `Rs. ${Number(val).toFixed(2)}`
    },
    {
      key: "status",
      label: "Status",
      align: "center" as const,
      render: (_: any, row: CustomerSummary) => (
        <StatusBadge status={row.isOverdue ? "OVERDUE" : "PENDING"} />
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit Accounts Ledger"
        description="Monitor outstanding customer invoices, track partial repayments, and audit credit summaries."
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        
        {/* LEFT COLUMN: Customer summaries list */}
        <div className="flex-1 space-y-4">
          <div className="border border-border rounded-card bg-card p-5 space-y-3">
            <h3 className="font-bold text-ink text-sm border-b border-border pb-2.5">
              Outstanding Accounts
            </h3>
            {isCustLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <DataTable
                columns={summaryColumns}
                data={customers}
                onRowClick={(row: CustomerSummary) => {
                  setSelectedPhone(row.phone);
                  setSelectedCustomerName(row.customerName);
                }}
                emptyMessage="No customer outstanding credit ledgers found."
                className={cn(selectedPhone && "border-primary/20")}
              />
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Passbook-style ledger detail view */}
        <div className="w-full lg:w-[480px] space-y-4 shrink-0">
          <div className="border border-border rounded-card bg-card p-5 min-h-[400px] flex flex-col justify-between shadow-xs">
            {selectedPhone ? (
              <div className="space-y-5 flex-1 flex flex-col justify-between">
                
                {/* Upper details header */}
                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="font-bold text-ink text-sm">{selectedCustomerName}</h3>
                      <p className="text-xs text-ink-muted mt-0.5 font-mono">{selectedPhone}</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPhone(null);
                        setSelectedCustomerName("");
                      }}
                      className="text-xs text-primary font-bold hover:underline"
                    >
                      Deselect
                    </button>
                  </div>

                  {isPassbookLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-4 overflow-y-auto max-h-[380px] pr-1 scrollbar-thin">
                      {passbook.map((ledger) => {
                        const totalPaid = ledger.payments.reduce((sum, p) => sum + Number(p.amount), 0);
                        const outstanding = Number(ledger.amount) - totalPaid;
                        const isUnsettled = ledger.status !== "PAID" && ledger.status !== "WRITTEN_OFF";

                        return (
                          <div
                            key={ledger.id}
                            className="rounded-card border border-border bg-surface-sunken p-4 space-y-3 relative overflow-hidden"
                          >
                            {/* Line head details */}
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                                  Origin: {ledger.source.replace("_", " ")}
                                </span>
                                <h4 className="font-bold text-ink text-xs mt-0.5">
                                  Rs. {Number(ledger.amount).toFixed(2)}
                                </h4>
                                <span className="text-[10px] text-ink-muted font-mono block mt-0.5">
                                  Given: {new Date(ledger.givenDate).toLocaleDateString()}
                                </span>
                              </div>
                              <StatusBadge status={ledger.status} className="text-[9px] px-2 py-0" />
                            </div>

                            {/* Repayments log */}
                            {ledger.payments.length > 0 && (
                              <div className="border-t border-border/40 pt-2 text-[10px] space-y-1 font-mono text-ink-muted">
                                <span className="font-bold uppercase text-[9px] text-ink block">Repayment Log:</span>
                                {ledger.payments.map((p) => (
                                  <div key={p.id} className="flex justify-between">
                                    <span>{new Date(p.paidAt).toLocaleDateString()}</span>
                                    <span className="text-success font-bold">+ Rs. {Number(p.amount).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Actions line */}
                            {isUnsettled && (
                              <div className="flex items-center gap-2 border-t border-border/40 pt-3">
                                <button
                                  onClick={() => {
                                    setSelectedLedgerId(ledger.id);
                                    setPaymentModalOpen(true);
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-control hover:bg-primary-hover active:scale-[0.99] transition-colors"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Record Payment</span>
                                </button>

                                {isAdmin && (
                                  <button
                                    onClick={() => handleWriteOff(ledger.id, outstanding)}
                                    className="px-2.5 py-1.5 border border-border hover:border-danger hover:text-danger rounded-control transition-colors"
                                    title="Write off bad debt"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-4 text-xs space-y-2 select-none">
                  <div className="flex justify-between text-ink-muted">
                    <span>Outstanding Invoices:</span>
                    <span className="font-bold text-ink">
                      {passbook.filter((l) => l.status !== "PAID" && l.status !== "WRITTEN_OFF").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-ink border-t border-border/50 pt-2 select-none">
                    <span>Total Phone Balance:</span>
                    <span className="text-primary tabular-nums">
                      Rs. {passbook
                        .filter((l) => l.status !== "PAID" && l.status !== "WRITTEN_OFF")
                        .reduce((sum, l) => {
                          const paid = l.payments.reduce((s, p) => s + Number(p.amount), 0);
                          return sum + (Number(l.amount) - paid);
                        }, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-20 text-ink-muted space-y-3 select-none flex-1">
                <History className="h-10 w-10 text-ink-muted/30" />
                <h4 className="font-bold text-sm text-ink">Passbook Viewer</h4>
                <p className="text-xs text-ink-muted max-w-[260px] leading-relaxed">
                  Select an outstanding customer ledger from the left to view active passbooks, payments, and settles.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL 4: RECORD PAYMENT */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedLedgerId(null);
          setPaymentAmount("");
          setPaymentError(null);
        }}
        title="Record Repayment Settle"
        footer={
          <>
            <button
              onClick={() => setPaymentModalOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="payment-form"
              disabled={paymentMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {paymentMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Settle Payment</span>
            </button>
          </>
        }
      >
        <form id="payment-form" onSubmit={handlePaymentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1">
              Repayment Amount (NPR)
            </label>
            <input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="e.g. 500.00"
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
            <span className="text-[10px] text-ink-muted mt-1 block">
              Enter the payment amount collected from the guest.
            </span>
          </div>

          {paymentError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {paymentError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
