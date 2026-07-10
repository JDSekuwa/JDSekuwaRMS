import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  delta?: {
    value: string | number;
    isPos: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  description,
  delta,
  icon,
  className
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-card p-6 text-card-foreground shadow-sm flex flex-col justify-between transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-ink-muted">{title}</span>
        {icon && <div className="text-ink-muted h-5 w-5">{icon}</div>}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-ink">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              delta.isPos
                ? "bg-success/15 text-success dark:bg-success/20"
                : "bg-danger/15 text-danger dark:bg-danger/20"
            )}
          >
            {delta.isPos ? "+" : ""}
            {delta.value}
          </span>
        )}
      </div>

      {(description || (delta && delta.label)) && (
        <p className="mt-1 text-xs text-ink-muted">
          {description || delta?.label}
        </p>
      )}
    </div>
  );
}
