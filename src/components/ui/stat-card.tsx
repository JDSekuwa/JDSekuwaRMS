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
  // Determine gradient ambient glow color based on the title or custom pattern
  const isRevenue = title.toLowerCase().includes("revenue") || title.toLowerCase().includes("sales");
  const isPos = title.toLowerCase().includes("pos") || title.toLowerCase().includes("quick");
  const isTable = title.toLowerCase().includes("table") || title.toLowerCase().includes("dine");
  
  let accentColorClass = "border-t-primary";
  let glowColor = "rgba(232, 89, 12, 0.04)"; // primary-orange glow
  let iconBg = "bg-primary/10 text-primary";

  if (isPos) {
    accentColorClass = "border-t-success";
    glowColor = "rgba(22, 163, 74, 0.04)"; // success-green glow
    iconBg = "bg-success/10 text-success";
  } else if (isTable) {
    accentColorClass = "border-t-info";
    glowColor = "rgba(37, 99, 235, 0.04)"; // info-blue glow
    iconBg = "bg-info/10 text-info";
  }

  return (
    <div
      className={cn(
        "group relative rounded-card border border-border bg-card p-6 text-card-foreground shadow-sm border-t-2",
        accentColorClass,
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.01] hover:shadow-md hover:border-primary/20",
        "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both",
        className
      )}
      style={{
        // Add subtle radial light highlight centered at bottom right on hover
        background: `radial-gradient(circle at 100% 100%, ${glowColor} 0%, transparent 70%), var(--card)`
      } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">{title}</span>
        {icon && (
          <div className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
            iconBg
          )}>
            <div className="h-5 w-5 flex items-center justify-center">
              {icon}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-ink group-hover:text-primary transition-colors duration-200">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
              delta.isPos
                ? "bg-success/15 text-success dark:bg-success/20"
                : "bg-danger/15 text-danger dark:bg-danger/20"
            )}
          >
            {delta.isPos ? "↑" : "↓"}
            {delta.value}
          </span>
        )}
      </div>

      {(description || (delta && delta.label)) && (
        <p className="mt-2 text-xs text-ink-muted font-medium line-clamp-1">
          {description || delta?.label}
        </p>
      )}
      
      {/* Decorative accent dot */}
      <div className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-border group-hover:bg-primary/45 transition-colors duration-300" />
    </div>
  );
}
