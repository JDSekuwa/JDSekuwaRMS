"use client";

import React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { BarChart3, TrendingUp, DollarSign, Calendar } from "lucide-react";

export default function ReportsPlaceholder() {
  const reportsList = [
    { title: "Daily Sales Summary", desc: "Detailed register of quick sales, table closeouts, and stays." },
    { title: "Item-wise Sales Volume", desc: "Fast-selling and slow-moving menu item volume registers." },
    { title: "Room Occupancy & Nights", desc: "Average check-in frequency and room night durations." },
    { title: "Purchase Cost Summary", desc: "Tabulated purchase totals grouped by raw ingredient categories." },
    { title: "Profit Margins Analysis", desc: "Gross revenues minus raw item purchase costs." },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Business Analytics"
        description="Access and download detailed financial statements and item logs."
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Monthly Profit Margin"
          value="Rs. 182,500.00"
          icon={<DollarSign />}
          delta={{ value: "8.4%", isPos: true }}
        />
        <StatCard
          title="Total Monthly Sales"
          value="Rs. 320,400.00"
          icon={<TrendingUp />}
          delta={{ value: "14.2%", isPos: true }}
        />
        <StatCard
          title="Room Occupancy Rate"
          value="85.4%"
          icon={<Calendar />}
          delta={{ value: "3.2%", isPos: true }}
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-ink">Analytical Report Documents</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reportsList.map((rep, idx) => (
            <div
              key={idx}
              className="rounded-card border border-border bg-card p-5 hover:shadow-md cursor-pointer transition-all flex items-start gap-4"
            >
              <div className="h-10 w-10 rounded-control bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-ink text-sm">{rep.title}</h4>
                <p className="text-xs text-ink-muted leading-relaxed">{rep.desc}</p>
                <button className="text-xs text-primary font-bold hover:underline pt-2 block">
                  Generate PDF Report
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
