"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: TableColumn[];
  data: any[];
  emptyMessage?: string;
  onRowClick?: (row: any) => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string, dir: "asc" | "desc") => void;
  className?: string;
}

export function DataTable({
  columns,
  data,
  emptyMessage = "No records found.",
  onRowClick,
  sortKey,
  sortDir,
  onSort,
  className
}: DataTableProps) {
  const handleSort = (column: TableColumn) => {
    if (!column.sortable || !onSort) return;
    
    let nextDir: "asc" | "desc" = "asc";
    if (sortKey === column.key) {
      nextDir = sortDir === "asc" ? "desc" : "asc";
    }
    
    onSort(column.key, nextDir);
  };

  return (
    <div className={cn("w-full overflow-x-auto rounded-card border border-border bg-card", className)}>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="border-b border-border bg-surface-sunken text-xs font-bold uppercase tracking-wider text-ink-muted">
          <tr>
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              const alignClass =
                column.align === "right"
                  ? "text-right"
                  : column.align === "center"
                  ? "text-center"
                  : "text-left";

              return (
                <th
                  key={column.key}
                  onClick={() => handleSort(column)}
                  className={cn(
                    "px-4 py-3 font-semibold transition-colors",
                    column.sortable && "cursor-pointer hover:bg-border/30 hover:text-ink select-none",
                    alignClass
                  )}
                >
                  <div className={cn("flex items-center gap-1.5", 
                    column.align === "right" && "justify-end",
                    column.align === "center" && "justify-center"
                  )}>
                    {column.label}
                    {column.sortable && isSorted && (
                      sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-ink">
          {data.length > 0 ? (
            data.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                onClick={() => onRowClick && onRowClick(row)}
                className={cn(
                  "transition-colors hover:bg-surface-sunken/50",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((column) => {
                  const val = row[column.key];
                  const alignClass =
                    column.align === "right"
                      ? "text-right font-mono tabular-nums"
                      : column.align === "center"
                      ? "text-center"
                      : "text-left";

                  return (
                    <td
                      key={column.key}
                      className={cn("px-4 py-2.5 whitespace-nowrap", alignClass)}
                    >
                      {column.render ? column.render(val, row) : (val !== null && val !== undefined ? String(val) : "-")}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-ink-muted">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
