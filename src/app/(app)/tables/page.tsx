"use client";

import React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Coffee, ChevronRight, UserPlus } from "lucide-react";

export default function TablesPlaceholder() {
  const mockTables = [
    { id: 1, name: "Table 1", status: "OCCUPIED", tag: "Lunch Order", total: "Rs. 2,100" },
    { id: 2, name: "Table 2", status: "VACANT", tag: null, total: null },
    { id: 3, name: "Table 3", status: "VACANT", tag: null, total: null },
    { id: 4, name: "Table 4", status: "RESERVED", tag: "Reservation 7 PM", total: null },
    { id: 5, name: "Table 5", status: "OCCUPIED", tag: "Drinks only", total: "Rs. 840" },
    { id: 6, name: "Table 6", status: "VACANT", tag: null, total: null },
    { id: 7, name: "Table 7", status: "VACANT", tag: null, total: null },
    { id: 8, name: "Table 8", status: "OCCUPIED", tag: "Family", total: "Rs. 4,650" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Table Sales & Booking"
        description="Live view of restaurant tables, occupancies, and running totals."
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-colors">
            <UserPlus className="h-4 w-4" />
            <span>Book Table</span>
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {mockTables.map((table) => (
          <div
            key={table.id}
            className="rounded-card border border-border bg-card p-5 flex flex-col justify-between h-[150px] shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            {/* Upper Info */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-ink text-base">{table.name}</h4>
                {table.tag && <p className="text-xs text-ink-muted mt-0.5">{table.tag}</p>}
              </div>
              <Coffee className={`h-5 w-5 ${table.status === "OCCUPIED" ? "text-primary" : "text-ink-muted/40"}`} />
            </div>

            {/* Bottom Actions/Details */}
            <div className="flex items-end justify-between mt-4">
              <div>
                <StatusBadge status={table.status} />
                {table.total && (
                  <p className="text-xs font-bold text-ink mt-1.5 tabular-nums">{table.total}</p>
                )}
              </div>
              {table.status === "OCCUPIED" ? (
                <button className="h-7 w-7 rounded-control bg-surface-sunken hover:bg-border flex items-center justify-center text-ink-muted hover:text-ink transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : table.status === "VACANT" ? (
                <button className="text-xs text-primary font-bold hover:underline">
                  Open Order
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
