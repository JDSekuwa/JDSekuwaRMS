import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normStatus = status.trim().toUpperCase();

  let colorClasses = "bg-ink/10 text-ink border-ink/20"; // default fallback

  if (["VACANT", "PAID", "CLOSED", "SUCCESS"].includes(normStatus)) {
    colorClasses = "bg-success/10 text-success border-success/20 dark:bg-success/20";
  } else if (["OCCUPIED", "PENDING", "PARTIAL", "WARNING"].includes(normStatus)) {
    colorClasses = "bg-warning/10 text-warning border-warning/20 dark:bg-warning/20";
  } else if (["RESERVED", "ACTIVE", "INFO"].includes(normStatus)) {
    colorClasses = "bg-info/10 text-info border-info/20 dark:bg-info/20";
  } else if (["VOIDED", "WRITTEN_OFF", "OVERDUE", "CANCELLED", "DANGER"].includes(normStatus)) {
    colorClasses = "bg-danger/10 text-danger border-danger/20 dark:bg-danger/20";
  }

  // Format status text for UI display (e.g. "WRITTEN_OFF" -> "Written Off", "VACANT" -> "Vacant")
  const displayText = normStatus
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold select-none",
        colorClasses,
        className
      )}
    >
      {displayText}
    </span>
  );
}
