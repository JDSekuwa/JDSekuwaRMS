"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { useQzTray } from "@/hooks/use-qz-tray";
import { useAuth } from "@/lib/auth-context";
import {
  Save,
  Printer,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { isConnected, printers } = useQzTray();
  const { role } = useAuth();
  const isSuperAdmin = role === "SUPER_ADMIN";

  // Local state for configuration settings
  const [kitchenPrinter, setKitchenPrinter] = useState("");
  const [receptionPrinter, setReceptionPrinter] = useState("");
  const [restaurantName, setRestaurantName] = useState("JD Sekuwa House");
  const [contactPhone, setContactPhone] = useState("+977-1-4XXXXXX");
  const [restaurantAddress, setRestaurantAddress] = useState("Lalitpur, Nepal");
  const [restaurantEmail, setRestaurantEmail] = useState("info@jdsekuwa.com");
  const [welcomeNote, setWelcomeNote] = useState("Welcome to JD Sekuwa House");
  const [thankYouNote, setThankYouNote] = useState("Thank you for dining with us!");

  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleDatabaseReset = async () => {
    const firstConfirm = window.confirm(
      "WARNING: Are you absolutely sure you want to reset the database? " +
      "This will erase all menu items, rooms, tables, sales records, booking stays, raw ingredients, and audit logs. " +
      "Staff user accounts will NOT be deleted. This action is IRREVERSIBLE."
    );
    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      "FINAL DANGER WARNING: Press OK to wipe all system business data now."
    );
    if (!secondConfirm) return;

    setIsResetting(true);
    try {
      const res = await fetch("/api/settings/reset", {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset database.");
      }
      alert(data.message || "Database reset completed successfully.");
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "An unexpected error occurred during database reset.");
    } finally {
      setIsResetting(false);
    }
  };

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
        if (parsed.restaurantAddress) setRestaurantAddress(parsed.restaurantAddress);
        if (parsed.restaurantEmail) setRestaurantEmail(parsed.restaurantEmail);
        if (parsed.welcomeNote) setWelcomeNote(parsed.welcomeNote);
        if (parsed.thankYouNote) setThankYouNote(parsed.thankYouNote);
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
      contactPhone,
      restaurantAddress,
      restaurantEmail,
      welcomeNote,
      thankYouNote
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
              <label className="block text-xs font-bold text-ink uppercase mb-1.5">Restaurant Name</label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1.5">Contact Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1.5">Restaurant Address</label>
              <input
                type="text"
                value={restaurantAddress}
                onChange={(e) => setRestaurantAddress(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1.5">Restaurant Email</label>
              <input
                type="email"
                value={restaurantEmail}
                onChange={(e) => setRestaurantEmail(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1.5">Welcome Note</label>
              <textarea
                value={welcomeNote}
                onChange={(e) => setWelcomeNote(e.target.value)}
                rows={2}
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1.5">Thank You Note</label>
              <input
                type="text"
                value={thankYouNote}
                onChange={(e) => setThankYouNote(e.target.value)}
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
              <label className="block text-xs font-bold text-ink uppercase mb-1.5">
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
              <label className="block text-xs font-bold text-ink uppercase mb-1.5">
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

      {/* DANGER ZONE (Super Admin Only) */}
      {isSuperAdmin && (
        <div className="rounded-card border border-danger/25 bg-danger/[0.01] p-6 space-y-4 animate-fade-in-up [animation-delay:200ms]">
          <h3 className="text-sm font-bold text-danger border-b border-danger/10 pb-2 flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5" />
            <span>Danger Zone (Administrative Operations)</span>
          </h3>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="space-y-1 max-w-xl">
              <span className="font-extrabold text-ink block">
                Reset System Database Tables
              </span>
              <p className="text-ink-muted text-[11px] leading-relaxed">
                Clears all seeded menu items, rooms, tables, ingredients, recipes, sales records, booking stays, ledger histories, and audit logs.
                <strong> Active staff account logins will not be deleted.</strong> This operation is permanent and cannot be undone.
              </p>
            </div>

            <button
              onClick={handleDatabaseReset}
              disabled={isResetting}
              className={cn(
                "flex items-center justify-center gap-1.5 px-4 py-2.5 bg-danger text-white text-xs font-bold rounded-control shadow-sm hover:bg-danger-hover transition-all shrink-0 active:scale-[0.98]",
                isResetting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isResetting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Resetting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Reset Database</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
