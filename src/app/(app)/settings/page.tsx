"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useQzTray } from "@/hooks/use-qz-tray";
import {
  Save,
  Printer,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { isConnected, printers } = useQzTray();

  // Local state for configuration settings
  const [kitchenPrinter, setKitchenPrinter] = useState("");
  const [receptionPrinter, setReceptionPrinter] = useState("");
  const [restaurantName, setRestaurantName] = useState("JD Sekuwa House");
  const [contactPhone, setContactPhone] = useState("+977-1-4XXXXXX");

  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Load configuration from local storage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("jd_sekuwa_printers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.kitchenPrinter) setKitchenPrinter(parsed.kitchenPrinter);
        if (parsed.receptionPrinter) setReceptionPrinter(parsed.receptionPrinter);
        if (parsed.restaurantName) setRestaurantName(parsed.restaurantName);
        if (parsed.contactPhone) setContactPhone(parsed.contactPhone);
      } catch (e) {
        console.warn("Failed to parse saved printer configurations:", e);
      }
    }
  }, []);

  const handleSaveSettings = () => {
    const config = {
      kitchenPrinter,
      receptionPrinter,
      restaurantName,
      contactPhone
    };
    localStorage.setItem("jd_sekuwa_printers", JSON.stringify(config));
    
    setSavedBanner("Terminal printer and receipt configurations saved successfully!");
    setTimeout(() => setSavedBanner(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <PageHeader
        title="Settings & Parameters"
        description="Configure client-side terminal thermal printers, company receipt formats, and connection parameters."
        actions={
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover transition-all duration-200 select-none shadow-xs active:scale-[0.98] animate-pulse-glow"
          >
            <Save className="h-4 w-4" />
            <span>Save Settings</span>
          </button>
        }
      />

      {/* FEEDBACK STATUS BANNER */}
      {savedBanner && (
        <div className="rounded-control border border-success/30 bg-success/10 p-4 text-xs text-success flex items-center gap-2.5 animate-fade-in-up">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* QZ TRAY CONNECTION STATUS BOX */}
      <div className={cn(
        "rounded-card border p-4 text-xs flex items-center justify-between shadow-xs animate-fade-in-up",
        isConnected
          ? "border-success/30 bg-success/[0.02]"
          : "border-warning/30 bg-warning/[0.02]"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center shadow-xs shrink-0",
            isConnected ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
          )}>
            <Printer className="h-4.5 w-4.5" />
          </div>
          <div className="space-y-0.5">
            <span className="font-extrabold text-ink block">
              QZ Printer Bridge: {isConnected ? "Connected" : "Disconnected"}
            </span>
            <p className="text-ink-muted text-[11px] leading-relaxed">
              {isConnected
                ? `Active socket bridge connected on localhost. Found ${printers.length} system hardware printer ports.`
                : "WebSocket bridge offline. Open the QZ Tray application on your till PC to enable silent ticket dispatch."}
            </p>
          </div>
        </div>

        {!isConnected && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-warning border border-warning/20 px-2 py-1 rounded-full bg-warning/5 select-none shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Browser Print Fallback Active</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up [animation-delay:100ms]">
        {/* Receipt Settings Card */}
        <div className="rounded-card border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-ink border-b border-border pb-2 flex items-center gap-2">
            <Info className="h-4.5 w-4.5 text-primary" />
            <span>Receipt Configuration</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">Restaurant Name</label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">Contact Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Printer Mapping Card */}
        <div className="rounded-card border border-border bg-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-ink border-b border-border pb-2 flex items-center gap-2">
            <Printer className="h-4.5 w-4.5 text-primary" />
            <span>Thermal Printers Setup</span>
          </h3>

          <div className="space-y-4 text-xs">
            {/* Reception Invoice Printer */}
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">
                Reception Printer Mapping
              </label>
              {isConnected && printers.length > 0 ? (
                <select
                  value={receptionPrinter}
                  onChange={(e) => setReceptionPrinter(e.target.value)}
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none bg-card focus:border-primary"
                >
                  <option value="">-- Choose Printer --</option>
                  {printers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Receipt-POS-80 (type or connect QZ Tray)"
                  value={receptionPrinter}
                  onChange={(e) => setReceptionPrinter(e.target.value)}
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              )}
            </div>

            {/* Kitchen Order Ticket Printer */}
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">
                Kitchen KOT Printer Mapping
              </label>
              {isConnected && printers.length > 0 ? (
                <select
                  value={kitchenPrinter}
                  onChange={(e) => setKitchenPrinter(e.target.value)}
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none bg-card focus:border-primary"
                >
                  <option value="">-- Choose Printer --</option>
                  {printers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Kitchen-Thermal-58 (type or connect QZ Tray)"
                  value={kitchenPrinter}
                  onChange={(e) => setKitchenPrinter(e.target.value)}
                  className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
