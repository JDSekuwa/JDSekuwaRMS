"use client";

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  className
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalItems);

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 rounded-card border border-border bg-card shadow-xs select-none", className)}>
      <div className="text-xs text-ink-muted">
        Showing <span className="font-extrabold text-ink">{startItem}</span> to{" "}
        <span className="font-extrabold text-ink">{endItem}</span> of{" "}
        <span className="font-extrabold text-ink">{totalItems}</span> results
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-control border border-border bg-card text-ink hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-card transition-colors"
          title="First Page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-control border border-border bg-card text-ink hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-card transition-colors mr-1"
          title="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum = currentPage - 2 + i;
          if (currentPage <= 2) pageNum = i + 1;
          if (currentPage >= totalPages - 1) pageNum = totalPages - 4 + i;
          
          pageNum = Math.max(1, Math.min(totalPages, pageNum));
          
          const isUnique = i === 0 || pageNum > (currentPage <= 2 ? i : currentPage - 2 + i - 1);
          if (pageNum > totalPages || !isUnique) return null;

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={cn(
                "h-7 w-7 rounded-control text-xs font-bold transition-all",
                currentPage === pageNum
                  ? "bg-primary text-white shadow-sm shadow-primary/15"
                  : "border border-border bg-card text-ink hover:bg-surface-sunken"
              )}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-control border border-border bg-card text-ink hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-card transition-colors ml-1"
          title="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-control border border-border bg-card text-ink hover:bg-surface-sunken disabled:opacity-40 disabled:hover:bg-card transition-colors"
          title="Last Page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
