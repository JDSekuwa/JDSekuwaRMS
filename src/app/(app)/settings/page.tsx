"use client";

import React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Save } from "lucide-react";

export default function SettingsPlaceholder() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Parameters"
        description="Global variables for printers, local VAT percent, and notifications."
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-colors">
            <Save className="h-4 w-4" />
            <span>Save Settings</span>
          </button>
        }
      />

      <div className="rounded-card border border-border bg-card p-6 space-y-6">
        {/* Receipt Settings */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-ink border-b border-border pb-2">Receipt Configuration</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">Restaurant Name</label>
              <input
                type="text"
                defaultValue="JD Sekuwa House"
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">Contact Phone</label>
              <input
                type="text"
                defaultValue="+977-1-4XXXXXX"
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Printer Settings */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-ink border-b border-border pb-2">Printer Settings (QZ Bridge)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">Reception Printer Name</label>
              <input
                type="text"
                defaultValue="Thermal-POS-80"
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">Kitchen Printer Name</label>
              <input
                type="text"
                defaultValue="Kitchen-Impact-Printer"
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
