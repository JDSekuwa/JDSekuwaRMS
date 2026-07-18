"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/lib/auth-context";
import { useQzTray } from "@/hooks/use-qz-tray";
import { getMenuItemImage } from "@/lib/menu-images";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal, Sheet } from "@/components/ui/modal-sheet";
import { cn } from "@/lib/utils";
import {
  Coffee,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Move,
  GitMerge,
  CreditCard,
  Utensils,
  UserCheck,
  CheckCircle,
  Printer,
  XCircle,
  Clock,
  Sparkles
} from "lucide-react";

/* ───────────────────────────── TYPES ───────────────────────────── */

interface TableSummary {
  id: string;
  name: string;
  status: "VACANT" | "OCCUPIED" | "RESERVED";
  currentTag: string | null;
  version: number;
  openOrderTotal: number;
  imageUrl?: string | null;
}

interface MenuItem {
  id: string;
  name: string;
  price: string;
  categoryId: string;
  imageUrl?: string | null;
}

interface Category {
  id: string;
  name: string;
  isKitchen: boolean;
}

interface MenuData {
  categories: Category[];
  menuItems: MenuItem[];
}

interface OrderItemPayload {
  id: string;
  qty: number;
  unitPrice: string;
  isVoid: boolean;
  menuItem: MenuItem;
}

interface TableOrderPayload {
  id: string;
  status: "OPEN" | "CLOSED" | "VOIDED";
  version: number;
  openedAt: string;
  openedById: string;
  items: OrderItemPayload[];
}

interface TableDetail {
  id: string;
  name: string;
  status: "VACANT" | "OCCUPIED" | "RESERVED";
  currentTag: string | null;
  version: number;
  orders: TableOrderPayload[];
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
}

interface ReceiptItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface ReceiptPayload {
  id: string;
  type: "TABLE_ORDER" | "QUICK_SALE";
  tableName: string | null;
  tag: string | null;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  paymentType: string | null;
  subtotal: number;
  discount: number;
  total: number;
  items: ReceiptItem[];
}

/* ═══════════════════════════ COMPONENT ══════════════════════════ */

export default function TablesPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Layout selection states
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  
  // Modals & Panels visibility state
  const [detailOpen, setDetailOpen] = useState(false);
  const [openOrderModalOpen, setOpenOrderModalOpen] = useState(false);
  const [addItemsModalOpen, setAddItemsModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Operational details states
  const [guestTag, setGuestTag] = useState("");
  const [tempCart, setTempCart] = useState<CartItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("ALL");
  const [targetTableId, setTargetTableId] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"CASH" | "CARD" | "CREDIT">("CASH");
  const [discount, setDiscount] = useState<number>(0);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);

  // General operational status alerts
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const [kitchenPrinter, setKitchenPrinter] = useState("");
  const [receptionPrinter, setReceptionPrinter] = useState("");
  const [restaurantName, setRestaurantName] = useState("JD Sekuwa House");
  const [restaurantAddress, setRestaurantAddress] = useState("Lalitpur, Nepal");
  const [restaurantEmail, setRestaurantEmail] = useState("");
  const [welcomeNote, setWelcomeNote] = useState("");
  const [thankYouNote, setThankYouNote] = useState("Thank you for dining with us!");

  const { isConnected: isQzConnected, printKot, printReceipt } = useQzTray();

  // Manage Floor states
  const [manageFloorOpen, setManageFloorOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableImageUrl, setNewTableImageUrl] = useState("");
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingTableName, setEditingTableName] = useState("");
  const [editingTableImageUrl, setEditingTableImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [floorError, setFloorError] = useState<string | null>(null);

  const handleImageUpload = async (file: File, type: "new" | "edit") => {
    setUploadingImage(true);
    setFloorError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Image upload failed");
      }
      const data = await res.json();
      if (type === "new") {
        setNewTableImageUrl(data.url);
      } else {
        setEditingTableImageUrl(data.url);
      }
    } catch (err: any) {
      setFloorError(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("jd_sekuwa_printers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.kitchenPrinter) setKitchenPrinter(parsed.kitchenPrinter);
        if (parsed.receptionPrinter) setReceptionPrinter(parsed.receptionPrinter);
        if (parsed.restaurantName) setRestaurantName(parsed.restaurantName);
        if (parsed.restaurantAddress) setRestaurantAddress(parsed.restaurantAddress);
        if (parsed.restaurantEmail) setRestaurantEmail(parsed.restaurantEmail);
        if (parsed.welcomeNote) setWelcomeNote(parsed.welcomeNote);
        if (parsed.thankYouNote) setThankYouNote(parsed.thankYouNote);
      } catch (e) {}
    }
  }, []);

  const handleBrowserPrint = () => {
    const printContent = document.getElementById("printable-receipt")?.innerHTML;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the receipt.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt Print</title>
          <style>
            body {
              font-family: monospace;
              padding: 20px;
              font-size: 14px;
              color: black;
            }
            .text-center { text-align: center; }
            .justify-between { display: flex; justify-content: space-between; }
            .font-bold { font-weight: bold; }
            .border-b { border-bottom: 1px solid #ccc; }
            .border-t { border-top: 1px solid #ccc; }
            .border-dashed { border-style: dashed; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .pt-1.5 { padding-top: 6px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-4 > * + * { margin-top: 16px; }
            .text-sm { font-size: 14px; }
            .text-[10px] { font-size: 10px; }
            .text-ink-muted { color: #666; }
            .font-extrabold { font-weight: 800; }
            .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .max-w-[180px] { max-width: 180px; }
            .w-full { width: 100%; }
          </style>
        </head>
        <body>
          <div>${printContent}</div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  /* ── 1. QUERIES ────────────────────────────────────────────────── */

  // Fetch list of tables
  const { data: tables = [], isLoading: isTablesLoading, refetch: refetchTables } = useQuery<TableSummary[]>({
    queryKey: ["tables"],
    queryFn: async () => {
      const res = await fetch("/api/tables");
      if (!res.ok) throw new Error("Failed to load tables list");
      return res.json();
    }
  });

  // Fetch single table detail including open order
  const { data: tableDetail, isLoading: isDetailLoading, refetch: refetchDetail } = useQuery<TableDetail>({
    queryKey: ["table-detail", selectedTableId],
    queryFn: async () => {
      const res = await fetch(`/api/tables/${selectedTableId}`);
      if (!res.ok) throw new Error("Failed to retrieve table detail");
      return res.json();
    },
    enabled: !!selectedTableId
  });

  // Fetch menu options for append menu items grid
  const { data: menuData } = useQuery<MenuData>({
    queryKey: ["pos-menu"],
    queryFn: async () => {
      const res = await fetch("/api/pos/menu");
      if (!res.ok) throw new Error("Failed to retrieve menu items");
      return res.json();
    },
    enabled: addItemsModalOpen
  });

  // Fetch receipt details for printer dialogs
  const { data: receipt, isLoading: isReceiptLoading } = useQuery<ReceiptPayload>({
    queryKey: ["receipt", receiptOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/pos/receipt/${receiptOrderId}`);
      if (!res.ok) throw new Error("Failed to fetch receipt payload");
      return res.json();
    },
    enabled: !!receiptOrderId
  });

  /* ── 2. REALTIME LISTENERS ──────────────────────────────────────── */

  useEffect(() => {
    const channel = supabase
      .channel("tables-page-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurant_tables" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tables"] });
          if (selectedTableId) queryClient.invalidateQueries({ queryKey: ["table-detail", selectedTableId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tables"] });
          if (selectedTableId) queryClient.invalidateQueries({ queryKey: ["table-detail", selectedTableId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["tables"] });
          if (selectedTableId) queryClient.invalidateQueries({ queryKey: ["table-detail", selectedTableId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, selectedTableId]);

  /* ── 3. MUTATIONS ──────────────────────────────────────────────── */

  // Helper handling HTTP conflict status codes
  const handleMutationError = (err: any) => {
    if (err.message.includes("409") || err.message.toLowerCase().includes("conflict") || err.message.toLowerCase().includes("version")) {
      setConflictWarning("Table operations conflict: Another waiter has updated this table. UI has refreshed.");
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      if (selectedTableId) queryClient.invalidateQueries({ queryKey: ["table-detail", selectedTableId] });
    } else {
      setActionError(err.message || "Operation failed.");
    }
  };

  // Open Table Order
  const openOrderMutation = useMutation({
    mutationFn: async ({ id, tag }: { id: string; tag: string }) => {
      const res = await fetch(`/api/tables/${id}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Open failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOpenOrderModalOpen(false);
      setGuestTag("");
      setActionError(null);
      // Select and open the sidebar sheet details
      setSelectedTableId(selectedTableId);
      setDetailOpen(true);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: handleMutationError
  });

  // Add Items to Table Order
  const addItemsMutation = useMutation({
    mutationFn: async ({ id, items }: { id: string; items: Array<{ menuItemId: string; qty: number }> }) => {
      const res = await fetch(`/api/tables/${id}/add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to add items (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      setAddItemsModalOpen(false);
      setTempCart([]);
      setActionError(null);
      
      // Auto-trigger KOT print if printer bridge connected
      if (selectedTableId) {
        refetchDetail();
        if (isQzConnected && kitchenPrinter) {
          fetch(`/api/tables/${selectedTableId}/kot`)
            .then(res => res.json())
            .then(kotPayload => {
              printKot(kitchenPrinter, kotPayload);
            })
            .catch(err => console.warn("[KOT print failed]:", err.message));
        }
      }
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: handleMutationError
  });

  // Void Order Item from open ticket
  const voidItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/order-items/${itemId}/void`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Void item failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      setActionError(null);
      if (selectedTableId) refetchDetail();
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: handleMutationError
  });

  // Move Table Order
  const moveMutation = useMutation({
    mutationFn: async ({ id, targetTableId }: { id: string; targetTableId: string }) => {
      const res = await fetch(`/api/tables/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTableId })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to transfer table (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      setMoveModalOpen(false);
      setTargetTableId("");
      setActionError(null);
      setDetailOpen(false);
      setSelectedTableId(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: handleMutationError
  });

  // Merge Table Orders
  const mergeMutation = useMutation({
    mutationFn: async ({ id, targetTableId }: { id: string; targetTableId: string }) => {
      const res = await fetch(`/api/tables/${id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTableId })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to combine tables (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      setMergeModalOpen(false);
      setTargetTableId("");
      setActionError(null);
      setDetailOpen(false);
      setSelectedTableId(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: handleMutationError
  });

  // Settle Table Order & Close table release
  const closeOrderMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await fetch(`/api/tables/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Settle bill failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      setSettleModalOpen(false);
      setDiscount(0);
      setCustomerName("");
      setPhone("");
      setActionError(null);
      setDetailOpen(false);

      // Resolve tableOrder ID to trigger print dialog
      const openOrder = tableDetail?.orders[0];
      if (openOrder) {
        setReceiptOrderId(openOrder.id);
        setReceiptModalOpen(true);

        // Auto-print receipt if printer bridge connected
        if (isQzConnected && receptionPrinter) {
          fetch(`/api/pos/receipt/${openOrder.id}`)
            .then(res => res.json())
            .then(receiptPayload => {
              printReceipt(receptionPrinter, receiptPayload);
            })
            .catch(err => console.warn("[Receipt print failed]:", err.message));
        }
      }

      setSelectedTableId(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: handleMutationError
  });

  // Create, Update, Delete table mutations
  const createTableMutation = useMutation({
    mutationFn: async (payload: { name: string; imageUrl?: string | null }) => {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create table");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewTableName("");
      setNewTableImageUrl("");
      setFloorError(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err: any) => setFloorError(err.message)
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { name: string; imageUrl?: string | null } }) => {
      const res = await fetch(`/api/tables/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update table");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditingTableId(null);
      setEditingTableName("");
      setEditingTableImageUrl("");
      setFloorError(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err: any) => setFloorError(err.message)
  });

  const deleteTableMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tables/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete table");
      }
      return res.json();
    },
    onSuccess: () => {
      setFloorError(null);
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err: any) => setFloorError(err.message)
  });

  /* ── 4. CART HELPERS ────────────────────────────────────────────── */

  const handleAddToCart = (item: MenuItem) => {
    const priceNum = parseFloat(item.price);
    const existing = tempCart.find((i) => i.menuItemId === item.id);
    if (existing) {
      setTempCart(
        tempCart.map((i) =>
          i.menuItemId === item.id ? { ...i, qty: i.qty + 1 } : i
        )
      );
    } else {
      setTempCart([...tempCart, { menuItemId: item.id, name: item.name, price: priceNum, qty: 1 }]);
    }
  };

  const handleUpdateCartQty = (menuItemId: string, delta: number) => {
    const item = tempCart.find((i) => i.menuItemId === menuItemId);
    if (!item) return;

    const nextQty = item.qty + delta;
    if (nextQty <= 0) {
      setTempCart(tempCart.filter((i) => i.menuItemId !== menuItemId));
    } else {
      setTempCart(
        tempCart.map((i) =>
          i.menuItemId === menuItemId ? { ...i, qty: nextQty } : i
        )
      );
    }
  };

  /* ── 5. RENDER LOGIC ────────────────────────────────────────────── */

  const activeOrder = tableDetail?.orders[0];
  const activeItems = activeOrder?.items.filter(i => !i.isVoid) || [];
  
  const subtotal = activeItems.reduce(
    (sum, item) => sum + Number(item.qty) * Number(item.unitPrice),
    0
  );
  
  const finalTotal = Math.max(0, subtotal - (isAdmin ? discount : 0));

  // Dine-in Tables metrics calculations
  const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
  const reservedTables = tables.filter((t) => t.status === "RESERVED").length;
  const vacantTables = tables.filter((t) => t.status === "VACANT").length;
  const totalTablesCount = tables.length;
  const tableOccupancyPercent = totalTablesCount > 0 ? Math.round((occupiedTables / totalTablesCount) * 100) : 0;
  const tableReservedPercent = totalTablesCount > 0 ? Math.round((reservedTables / totalTablesCount) * 100) : 0;
  const tableVacantPercent = totalTablesCount > 0 ? Math.round((vacantTables / totalTablesCount) * 100) : 0;

  const filteredMenuItems = menuData?.menuItems.filter(item => {
    if (selectedCatId === "ALL") return true;
    return item.categoryId === selectedCatId;
  }) || [];

  return (
    <div className="space-y-6">
      {/* HEADER WITH REALTIME BADGE */}
      <PageHeader
        title="Table Sales & Booking"
        description="Monitor active tables, process floor bills, transfer table tickets, and combine dine-in accounts."
        actions={
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setManageFloorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-all duration-200 select-none active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Manage Floor</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/15 text-success rounded-full text-[10px] font-bold tracking-wide uppercase border border-success/20 select-none shadow-xs">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
              </span>
              <span>Realtime Connected</span>
            </div>

            <button
              onClick={() => refetchTables()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-border border border-border text-ink hover:text-primary text-xs font-semibold rounded-control transition-all duration-200 select-none shadow-xs active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Floor</span>
            </button>
          </div>
        }
      />

      {/* FLOOR OCCUPANCY SUMMARY — STAT TILES */}
      {tables.length > 0 && (
        <div className="animate-fade-in-up space-y-3">
          {/* Stat Tiles Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Total Tables */}
            <div className="relative rounded-card overflow-hidden border border-border shadow-sm group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-20 group-hover:opacity-30 transition-opacity duration-500"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80')` }}
              />
              <div className="relative p-4 space-y-1.5 bg-gradient-to-br from-card/90 to-card/70">
                <p className="text-[9px] font-black text-ink-muted uppercase tracking-widest">Total Tables</p>
                <p className="text-3xl font-black text-ink tabular-nums">{totalTablesCount}</p>
                <p className="text-[9px] font-bold text-ink-muted/60">On active floor</p>
              </div>
            </div>

            {/* Vacant */}
            <div className="relative rounded-card overflow-hidden border border-success/30 shadow-sm group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80')` }}
              />
              <div className="relative p-4 space-y-1.5 bg-gradient-to-br from-success/5 to-success/[0.02]">
                <p className="text-[9px] font-black text-success/80 uppercase tracking-widest">Vacant</p>
                <p className="text-3xl font-black text-success tabular-nums">{vacantTables}</p>
                <p className="text-[9px] font-bold text-ink-muted/60">Ready to seat</p>
              </div>
            </div>

            {/* Occupied */}
            <div className="relative rounded-card overflow-hidden border border-primary/30 shadow-sm group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80')` }}
              />
              <div className="relative p-4 space-y-1.5 bg-gradient-to-br from-primary/5 to-primary/[0.02]">
                <p className="text-[9px] font-black text-primary/80 uppercase tracking-widest">Occupied</p>
                <p className="text-3xl font-black text-primary tabular-nums">{occupiedTables}</p>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                  </span>
                  <p className="text-[9px] font-bold text-ink-muted/60">Active dine-in</p>
                </div>
              </div>
            </div>

            {/* Reserved */}
            <div className="relative rounded-card overflow-hidden border border-warning/30 shadow-sm group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=400&q=80')` }}
              />
              <div className="relative p-4 space-y-1.5 bg-gradient-to-br from-warning/5 to-warning/[0.02]">
                <p className="text-[9px] font-black text-warning/80 uppercase tracking-widest">Reserved</p>
                <p className="text-3xl font-black text-warning tabular-nums">{reservedTables}</p>
                <p className="text-[9px] font-bold text-ink-muted/60">Held for guests</p>
              </div>
            </div>
          </div>

          {/* Segmented Occupancy Bar */}
          <div className="rounded-card border border-border bg-card px-5 py-3.5 shadow-xs flex items-center gap-4">
            <Utensils className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="flex-1 h-2 bg-surface-sunken rounded-full overflow-hidden flex">
              <div className="bg-primary h-full transition-all duration-700 ease-out rounded-l-full" style={{ width: `${tableOccupancyPercent}%` }} />
              <div className="bg-warning h-full transition-all duration-700 ease-out" style={{ width: `${tableReservedPercent}%` }} />
              <div className="bg-success h-full transition-all duration-700 ease-out rounded-r-full" style={{ width: `${tableVacantPercent}%` }} />
            </div>
            <span className="text-[10px] font-black text-ink-muted tabular-nums shrink-0">{tableOccupancyPercent}% occupied</span>
          </div>
        </div>
      )}

      {/* DYNAMIC CONFLICT ALERT */}
      {conflictWarning && (
        <div className="rounded-control border border-warning/30 bg-warning/10 p-4 text-xs text-warning flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
            <span>{conflictWarning}</span>
          </div>
          <button
            onClick={() => setConflictWarning(null)}
            className="text-[10px] font-bold underline hover:no-underline ml-4"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* TABLES LAYOUT GRID — PREMIUM AMBIENT CARDS */}
      {isTablesLoading ? (
        <div className="flex h-[40vh] w-full items-center justify-center text-primary">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 animate-fade-in-up [animation-delay:150ms]">
          {tables.map((table, index) => {
            const isOccupied = table.status === "OCCUPIED";
            const isReserved = table.status === "RESERVED";
            const isVacant = table.status === "VACANT";

            // Rotate through curated restaurant ambiance images
            const ambientImages = [
              "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
              "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
              "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=600&q=80",
              "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80",
              "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600&q=80",
              "https://images.unsplash.com/photo-1550966871-3ed3cfd8a5d3?w=600&q=80",
              "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80",
              "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
            ];
            const bgImage = table.imageUrl || ambientImages[index % ambientImages.length];

            return (
              <div
                key={table.id}
                onClick={() => {
                  setSelectedTableId(table.id);
                  if (isVacant) {
                    setOpenOrderModalOpen(true);
                  } else {
                    setDetailOpen(true);
                  }
                }}
                className={cn(
                  "group relative rounded-card overflow-hidden cursor-pointer select-none transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl",
                  "h-[200px] sm:h-[220px]"
                )}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                {/* Background ambient restaurant photo */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                  style={{ backgroundImage: `url('${bgImage}')` }}
                />

                {/* Dark gradient scrim — stronger at bottom for text readability */}
                <div className={cn(
                  "absolute inset-0 transition-opacity duration-300",
                  isOccupied
                    ? "bg-gradient-to-t from-black/100 via-black/75 to-primary/20"
                    : isReserved
                    ? "bg-gradient-to-t from-black/100 via-black/75 to-warning/20"
                    : "bg-gradient-to-t from-black/95 via-black/60 to-black/20 group-hover:from-black/90"
                )} />

                {/* Status glow ring on border */}
                <div className={cn(
                  "absolute inset-0 rounded-card ring-inset transition-all duration-300",
                  isOccupied && "ring-2 ring-primary/60",
                  isReserved && "ring-2 ring-warning/60",
                  isVacant && "ring-1 ring-white/10 group-hover:ring-success/40"
                )} />

                {/* TOP ROW — table number + live status beacon */}
                <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10">
                  <div>
                    <span className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10">
                      <Utensils className="h-2.5 w-2.5 opacity-70" />
                      {table.name}
                    </span>
                  </div>

                  {/* Live status beacon */}
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border backdrop-blur-sm",
                    isOccupied && "bg-primary/20 border-primary/40 text-primary-foreground",
                    isReserved && "bg-warning/20 border-warning/40 text-warning",
                    isVacant && "bg-success/20 border-success/40 text-success"
                  )}>
                    <span className="relative flex h-1.5 w-1.5">
                      {isOccupied && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      )}
                      <span className={cn(
                        "relative inline-flex rounded-full h-1.5 w-1.5",
                        isOccupied && "bg-primary",
                        isReserved && "bg-warning",
                        isVacant && "bg-success"
                      )} />
                    </span>
                    <span>{isOccupied ? "Occupied" : isReserved ? "Reserved" : "Vacant"}</span>
                  </div>
                </div>

                {/* Physical seat dots — decorative corners */}
                <div className="absolute top-1/2 -translate-y-1/2 left-2 flex flex-col gap-2 pointer-events-none z-10 opacity-60">
                  <div className={cn("h-2 w-2 rounded-full border border-white/30", isOccupied ? "bg-primary/70" : isReserved ? "bg-warning/70" : "bg-white/20")} />
                  <div className={cn("h-2 w-2 rounded-full border border-white/30", isOccupied ? "bg-primary/70" : isReserved ? "bg-warning/70" : "bg-white/20")} />
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 right-2 flex flex-col gap-2 pointer-events-none z-10 opacity-60">
                  <div className={cn("h-2 w-2 rounded-full border border-white/30", isOccupied ? "bg-primary/70" : isReserved ? "bg-warning/70" : "bg-white/20")} />
                  <div className={cn("h-2 w-2 rounded-full border border-white/30", isOccupied ? "bg-primary/70" : isReserved ? "bg-warning/70" : "bg-white/20")} />
                </div>

                {/* BOTTOM ROW — tag + running total */}
                <div className="absolute bottom-0 left-0 right-0 p-3 z-10 space-y-1">
                  {table.currentTag ? (
                    <p className="text-[10px] text-white font-extrabold uppercase tracking-widest truncate text-shadow-readability" title={table.currentTag}>
                      {table.currentTag}
                    </p>
                  ) : (
                    <p className="text-[9px] text-white/80 font-black italic text-shadow-readability">
                      {isVacant ? "Tap to open order" : "No active tag"}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    {isOccupied && table.openOrderTotal > 0 ? (
                      <>
                        <span className="text-[9px] text-white/90 font-black uppercase text-shadow-readability">Running Bill</span>
                        <span className="text-base font-black text-white tabular-nums tracking-tight text-shadow-readability">
                          Rs. {Number(table.openOrderTotal).toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span className="text-[9px] text-white/75 font-black text-shadow-readability">
                        {isVacant ? "No active bill" : isReserved ? "Held for reservation" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Hover action hint */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                  <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                    {isVacant ? "Open Table" : "View Order"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FOR FLOOR MANAGEMENT */}
      <Modal
        isOpen={manageFloorOpen}
        onClose={() => {
          setManageFloorOpen(false);
          setEditingTableId(null);
          setNewTableName("");
          setNewTableImageUrl("");
          setFloorError(null);
        }}
        title="Manage Restaurant Floor Plan"
        className="max-w-3xl"
        footer={
          <button
            onClick={() => {
              setManageFloorOpen(false);
              setEditingTableId(null);
              setNewTableName("");
              setNewTableImageUrl("");
              setFloorError(null);
            }}
            className="px-4 py-2 bg-surface-sunken hover:bg-border text-ink text-xs font-semibold rounded-control transition-colors"
          >
            Close Panel
          </button>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEFT SIDE: ADD/EDIT FORM */}
            <div className="space-y-4 border-r border-border pr-0 md:pr-6">
              <h4 className="text-xs font-black text-ink-muted uppercase tracking-wider">
                {editingTableId ? "Edit Table Details" : "Add New Table"}
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                    Table Designation / Name
                  </label>
                  <input
                    type="text"
                    value={editingTableId ? editingTableName : newTableName}
                    onChange={(e) => {
                      if (editingTableId) setEditingTableName(e.target.value);
                      else setNewTableName(e.target.value);
                    }}
                    placeholder="e.g. Table 9, Private Cabin A"
                    className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary bg-card"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                    Ambiance Image (Optional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, editingTableId ? "edit" : "new");
                      }}
                      className="w-full text-xs text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:text-[11px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
                    />
                    {uploadingImage && (
                      <div className="flex items-center gap-1.5 text-[10px] text-primary font-semibold">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Uploading image to server...</span>
                      </div>
                    )}
                    {(editingTableId ? editingTableImageUrl : newTableImageUrl) && (
                      <div className="relative h-20 w-32 rounded-control overflow-hidden border border-border mt-1.5">
                        <img
                          src={editingTableId ? editingTableImageUrl : newTableImageUrl}
                          alt="Ambiance preview"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingTableId) setEditingTableImageUrl("");
                            else setNewTableImageUrl("");
                          }}
                          className="absolute top-1 right-1 p-0.5 bg-black/70 text-white hover:text-danger rounded-full"
                          title="Remove image"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  {editingTableId ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!editingTableName) return;
                          updateTableMutation.mutate({
                            id: editingTableId,
                            payload: { name: editingTableName, imageUrl: editingTableImageUrl || null }
                          });
                        }}
                        disabled={updateTableMutation.isPending || uploadingImage}
                        className="flex-1 py-2 bg-primary text-white font-bold rounded-control hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {updateTableMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save Edits
                      </button>
                      <button
                        onClick={() => {
                          setEditingTableId(null);
                          setEditingTableName("");
                          setEditingTableImageUrl("");
                        }}
                        className="px-3 py-2 bg-surface-sunken hover:bg-border text-ink font-semibold rounded-control transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!newTableName) return;
                        createTableMutation.mutate({
                          name: newTableName,
                          imageUrl: newTableImageUrl || null
                        });
                      }}
                      disabled={createTableMutation.isPending || uploadingImage}
                      className="w-full py-2 bg-primary text-white font-bold rounded-control hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {createTableMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Add Table
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: LIST OF TABLES */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-ink-muted uppercase tracking-wider">
                Existing Tables ({tables.length})
              </h4>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                {tables.map((t) => {
                  const isDeletable = t.status === "VACANT" && t.openOrderTotal === 0;

                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded-control border border-border bg-surface-sunken/45 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {t.imageUrl ? (
                          <img
                            src={t.imageUrl}
                            alt={t.name}
                            className="h-8 w-12 rounded-control object-cover border border-border"
                          />
                        ) : (
                          <div className="h-8 w-12 rounded-control bg-border/50 flex items-center justify-center text-ink-muted">
                            <Utensils className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div>
                          <span className="font-extrabold text-ink">{t.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              t.status === "OCCUPIED" && "bg-primary animate-pulse",
                              t.status === "RESERVED" && "bg-warning",
                              t.status === "VACANT" && "bg-success"
                            )} />
                            <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wide">
                              {t.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingTableId(t.id);
                            setEditingTableName(t.name);
                            setEditingTableImageUrl(t.imageUrl || "");
                          }}
                          className="p-1 text-ink-muted hover:text-primary transition-colors hover:bg-border rounded-control"
                          title="Edit Table"
                        >
                          <Plus className="h-3.5 w-3.5 rotate-45" />
                        </button>
                        <button
                          disabled={!isDeletable || deleteTableMutation.isPending}
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete table '${t.name}'?`)) {
                              deleteTableMutation.mutate(t.id);
                            }
                          }}
                          className="p-1 text-ink-muted hover:text-danger disabled:opacity-30 transition-colors hover:bg-border rounded-control"
                          title={isDeletable ? "Delete Table" : "Cannot delete occupied/billed table"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {floorError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
              {floorError}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 1: OPEN VACANT TABLE */}
      <Modal
        isOpen={openOrderModalOpen}
        onClose={() => {
          setOpenOrderModalOpen(false);
          setGuestTag("");
          setActionError(null);
        }}
        title="Open Table Ticket"
        footer={
          <>
            <button
              onClick={() => setOpenOrderModalOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedTableId) {
                  openOrderMutation.mutate({ id: selectedTableId, tag: guestTag });
                }
              }}
              disabled={openOrderMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {openOrderMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Open Dine-in Order</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-control bg-surface-sunken p-3 text-xs text-ink-muted font-medium border border-border">
            You are opening a new order on <span className="font-extrabold text-ink">{tables.find(t => t.id === selectedTableId)?.name}</span>.
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">
              Guest Tracking Tag (Optional)
            </label>
            <input
              type="text"
              value={guestTag}
              onChange={(e) => setGuestTag(e.target.value)}
              placeholder="e.g. Lunch with Family, Drinks section"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          {actionError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {actionError}
            </div>
          )}
        </div>
      </Modal>

      {/* SHEET 2: ACTIVE ORDER SIDE DRAWER */}
      <Sheet
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedTableId(null);
          setActionError(null);
        }}
        title={`Table Details — ${tableDetail?.name || ""}`}
        footer={
          <div className="flex flex-col gap-2 w-full">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setMoveModalOpen(true)}
                className="flex items-center justify-center gap-1 px-2.5 py-2 border border-border hover:border-ink hover:bg-surface-sunken text-ink text-xs font-bold rounded-control transition-colors"
              >
                <Move className="h-3.5 w-3.5 text-ink-muted" />
                <span>Move</span>
              </button>
              <button
                onClick={() => setMergeModalOpen(true)}
                className="flex items-center justify-center gap-1 px-2.5 py-2 border border-border hover:border-ink hover:bg-surface-sunken text-ink text-xs font-bold rounded-control transition-colors"
              >
                <GitMerge className="h-3.5 w-3.5 text-ink-muted" />
                <span>Merge</span>
              </button>
              <button
                onClick={() => setAddItemsModalOpen(true)}
                className="flex items-center justify-center gap-1 px-2.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-control transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Items</span>
              </button>
            </div>
            {activeItems.length > 0 && (
              <button
                onClick={() => setSettleModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-control shadow-md hover:bg-primary-hover transition-colors"
              >
                <CreditCard className="h-4 w-4" />
                <span>Checkout & Settle (Rs. {finalTotal.toFixed(0)})</span>
              </button>
            )}
          </div>
        }
      >
        {isDetailLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Table status header summary */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-ink-muted tracking-wider block">Current Tag</span>
                <span className="font-extrabold text-sm text-ink">{tableDetail?.currentTag || "No tag specified"}</span>
              </div>
              <StatusBadge status={tableDetail?.status || "VACANT"} />
            </div>

            {/* Action/Service warnings */}
            {actionError && (
              <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger mb-4">
                {actionError}
              </div>
            )}

            {/* Bill Lines */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-ink uppercase tracking-wider">Dine-in Ticket Items</h4>
              {activeItems.length > 0 ? (
                <div className="border border-border rounded-card bg-surface-sunken/40 divide-y divide-border/60">
                  {activeItems.map((item) => (
                    <div key={item.id} className="flex items-start justify-between p-3.5 text-xs">
                      <div className="space-y-0.5 max-w-[200px]">
                        <h5 className="font-extrabold text-ink leading-tight">{item.menuItem.name}</h5>
                        <span className="text-ink-muted font-mono">
                          Rs. {Number(item.unitPrice).toFixed(0)} × {item.qty}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-ink tabular-nums pr-1">
                          Rs. {(Number(item.unitPrice) * item.qty).toFixed(0)}
                        </span>
                        
                        {/* Void line item */}
                        <button
                          disabled={voidItemMutation.isPending}
                          onClick={() => {
                            if (confirm(`Void '${item.menuItem.name}' from Table order?`)) {
                              voidItemMutation.mutate(item.id);
                            }
                          }}
                          className="text-ink-muted/40 hover:text-danger p-1 rounded-control transition-colors"
                          title="Void item"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Totals Summary */}
                  <div className="p-3.5 bg-surface-sunken flex justify-between items-center text-xs font-bold text-ink border-t border-border">
                    <span className="uppercase text-[10px] text-ink-muted tracking-wider">Subtotal</span>
                    <span className="text-sm text-primary tabular-nums">Rs. {subtotal.toFixed(0)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-xs text-ink-muted italic border border-dashed border-border rounded-card bg-surface-sunken/20">
                  No active items currently added on this table order.
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>

      {/* MODAL 3: ADD ITEMS (POS GRID IFRAME) */}
      <Modal
        isOpen={addItemsModalOpen}
        onClose={() => {
          setAddItemsModalOpen(false);
          setTempCart([]);
          setActionError(null);
        }}
        title="Add Items to Table"
        className="max-w-4xl h-[85vh]"
        footer={
          <>
            <button
              onClick={() => {
                setAddItemsModalOpen(false);
                setTempCart([]);
              }}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={tempCart.length === 0 || addItemsMutation.isPending}
              onClick={() => {
                if (selectedTableId) {
                  addItemsMutation.mutate({
                    id: selectedTableId,
                    items: tempCart.map(i => ({ menuItemId: i.menuItemId, qty: i.qty }))
                  });
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors animate-pulse-glow"
            >
              {addItemsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Send to Kitchen (KOT)</span>
            </button>
          </>
        }
      >
        <div className="flex flex-col md:flex-row gap-5 h-full max-h-[60vh]">
          {/* Menu selection side */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 border-b border-border scrollbar-none select-none">
              <button
                onClick={() => setSelectedCatId("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase whitespace-nowrap transition-colors",
                  selectedCatId === "ALL"
                    ? "bg-primary text-white"
                    : "bg-surface-sunken text-ink-muted hover:bg-border"
                )}
              >
                All
              </button>
              {menuData?.categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase whitespace-nowrap transition-colors",
                    selectedCatId === cat.id
                      ? "bg-primary text-white"
                      : "bg-surface-sunken text-ink-muted hover:bg-border"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredMenuItems.map((item) => {
                const inCart = tempCart.find((i) => i.menuItemId === item.id);
                const categoryObj = menuData?.categories.find((c) => c.id === item.categoryId);
                const categoryName = categoryObj ? categoryObj.name : "";
                const imageUrl = item.imageUrl || getMenuItemImage(item.name, categoryName);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className={cn(
                      "group rounded-card border overflow-hidden bg-card hover:shadow-lg cursor-pointer flex flex-col justify-between h-[180px] transition-all duration-300 relative select-none transform active:scale-[0.98]",
                      inCart
                        ? "border-primary ring-1 ring-primary/20 shadow-sm"
                        : "border-border hover:border-border-hover"
                    )}
                  >
                    {/* Visual Card Image Header */}
                    <div className="h-[95px] w-full relative overflow-hidden bg-surface-sunken">
                      <img
                        src={imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      {categoryName && (
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[8px] font-black text-white uppercase tracking-wider select-none">
                          {categoryName}
                        </span>
                      )}

                      {/* Floating Indicator Bubble */}
                      {inCart && (
                        <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-black shadow-sm animate-scale-up">
                          {inCart.qty}
                        </div>
                      )}
                    </div>

                    {/* Details Info Footer */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <h5 className="font-extrabold text-ink text-xs line-clamp-1 leading-tight group-hover:text-primary transition-colors duration-200" title={item.name}>
                        {item.name}
                      </h5>
                      <div className="flex items-center justify-between mt-2 select-none">
                        <span className="text-[11px] font-black text-ink font-mono tabular-nums">
                          Rs. {Number(item.price).toFixed(0)}
                        </span>

                        <span className={cn(
                          "h-5 px-2 rounded-control flex items-center gap-1 text-[9px] font-black shrink-0 transition-colors duration-200",
                          inCart
                            ? "bg-primary text-white"
                            : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                        )}>
                          <Plus className="h-2.5 w-2.5 shrink-0" />
                          <span>Add</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Addition Cart side */}
          <div className="w-full md:w-[280px] border border-border rounded-card bg-surface-sunken/40 p-4 flex flex-col justify-between shrink-0">
            <div>
              <h4 className="font-extrabold text-xs text-ink border-b border-border pb-2 flex items-center justify-between">
                <span>Pending Additions</span>
                <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">
                  {tempCart.reduce((sum, i) => sum + i.qty, 0)} items
                </span>
              </h4>
              <div className="overflow-y-auto max-h-[35vh] py-3 space-y-3 scrollbar-thin divide-y divide-border/40">
                {tempCart.map((item, idx) => (
                  <div key={item.menuItemId} className={cn("flex justify-between items-start text-xs", idx > 0 && "pt-3")}>
                    <div className="space-y-0.5 max-w-[130px]">
                      <h5 className="font-bold text-ink leading-tight truncate">{item.name}</h5>
                      <span className="text-[10px] text-ink-muted">Rs. {item.price.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleUpdateCartQty(item.menuItemId, -1)}
                        className="h-5.5 w-5.5 rounded-control bg-surface-sunken hover:bg-border text-ink flex items-center justify-center transition-colors"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-extrabold text-ink w-3 text-center tabular-nums text-[11px]">{item.qty}</span>
                      <button
                        onClick={() => handleUpdateCartQty(item.menuItemId, 1)}
                        className="h-5.5 w-5.5 rounded-control bg-surface-sunken hover:bg-border text-ink flex items-center justify-center transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {tempCart.length === 0 && (
                  <div className="text-center py-12 text-ink-muted text-[11px] italic">
                    Click items in the grid to append them to the cart addition checklist.
                  </div>
                )}
              </div>
            </div>
            
            {actionError && (
              <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-[10px] text-danger mt-3">
                {actionError}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL 4: MOVE TABLE */}
      <Modal
        isOpen={moveModalOpen}
        onClose={() => {
          setMoveModalOpen(false);
          setTargetTableId("");
          setActionError(null);
        }}
        title="Transfer Table Order"
        footer={
          <>
            <button
              onClick={() => setMoveModalOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!targetTableId || moveMutation.isPending}
              onClick={() => {
                if (selectedTableId) {
                  moveMutation.mutate({ id: selectedTableId, targetTableId });
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {moveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Transfer Ticket</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-control bg-surface-sunken p-3 text-xs text-ink-muted font-medium border border-border">
            You are transferring the running order from <span className="font-extrabold text-ink">{tableDetail?.name}</span> to a vacant table.
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">
              Select Vacant Destination Table
            </label>
            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none bg-card focus:border-primary"
            >
              <option value="">-- Choose Vacant Table --</option>
              {tables
                .filter((t) => t.status === "VACANT")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          {actionError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {actionError}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 5: MERGE TABLES */}
      <Modal
        isOpen={mergeModalOpen}
        onClose={() => {
          setMergeModalOpen(false);
          setTargetTableId("");
          setActionError(null);
        }}
        title="Merge Table Orders"
        footer={
          <>
            <button
              onClick={() => setMergeModalOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!targetTableId || mergeMutation.isPending}
              onClick={() => {
                if (selectedTableId) {
                  mergeMutation.mutate({ id: selectedTableId, targetTableId });
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {mergeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Combine Tickets</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-control bg-surface-sunken p-3 text-xs text-ink-muted font-medium border border-border">
            You are combining all items from <span className="font-extrabold text-ink">{tableDetail?.name}</span> into another active table order. The current table will be freed.
          </div>
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">
              Select Occupied Destination Table
            </label>
            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none bg-card focus:border-primary"
            >
              <option value="">-- Choose Occupied Table --</option>
              {tables
                .filter((t) => t.status === "OCCUPIED" && t.id !== selectedTableId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.currentTag ? `(${t.currentTag})` : ""}
                  </option>
                ))}
            </select>
          </div>
          {actionError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {actionError}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 6: BILL SETTLEMENT */}
      <Modal
        isOpen={settleModalOpen}
        onClose={() => {
          setSettleModalOpen(false);
          setDiscount(0);
          setCustomerName("");
          setPhone("");
          setActionError(null);
        }}
        title={`Settle Bill — Table ${tableDetail?.name}`}
        footer={
          <>
            <button
              onClick={() => setSettleModalOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={closeOrderMutation.isPending}
              onClick={() => {
                if (selectedTableId) {
                  if (paymentType === "CREDIT" && (!customerName || !phone)) {
                    setActionError("Customer name and phone number are required for credit checkouts");
                    return;
                  }
                  closeOrderMutation.mutate({
                    id: selectedTableId,
                    payload: {
                      paymentType,
                      discount,
                      customerInfo: customerName && phone ? { customerName, phone } : undefined
                    }
                  });
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors animate-pulse-glow"
            >
              {closeOrderMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Settle Payment</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Payment Type Selection */}
          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">
              Settlement Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "CARD", "CREDIT"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPaymentType(type)}
                  className={cn(
                    "py-1.5 rounded-control text-xs font-semibold border transition-all text-center select-none",
                    paymentType === type
                      ? "bg-primary border-primary text-white shadow-sm"
                      : "border-border text-ink-muted hover:bg-surface-sunken"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Inputs (for Credit) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                Guest Name {paymentType === "CREDIT" && "*"}
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest Name"
                required={paymentType === "CREDIT"}
                className="w-full rounded-control border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                Phone Number {paymentType === "CREDIT" && "*"}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                required={paymentType === "CREDIT"}
                className="w-full rounded-control border border-border px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Pricing Totals Section */}
          <div className="space-y-2 border-t border-border/50 pt-3 text-xs">
            <div className="flex justify-between text-ink-muted">
              <span>Subtotal</span>
              <span className="font-semibold tabular-nums text-ink">Rs. {subtotal.toFixed(2)}</span>
            </div>

            {/* Discount input (Admin approval gated) */}
            <div className="flex justify-between items-center text-ink-muted">
              <span>Discount</span>
              {isAdmin ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-ink-muted">NPR</span>
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    value={discount || ""}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-24 rounded-control border border-border px-2 py-0.5 text-right font-mono text-xs text-ink outline-none focus:border-primary"
                  />
                </div>
              ) : (
                <span className="font-mono text-ink-muted italic text-[11px]">
                  Rs. 0.00 (Restricted)
                </span>
              )}
            </div>

            <div className="flex justify-between text-sm font-bold text-ink border-t border-border/50 pt-2.5 select-none">
              <span>Final Total</span>
              <span className="text-primary tabular-nums">Rs. {finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {actionError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-[11px] text-danger">
              {actionError}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 7: SUCCESS RECEIPT VIEW */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptOrderId(null);
        }}
        title="Table Settle Success — Sales Invoice"
        footer={
          <button
            onClick={() => {
              setReceiptModalOpen(false);
              setReceiptOrderId(null);
            }}
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-colors"
          >
            Done & Close
          </button>
        }
      >
        {isReceiptLoading || !receipt ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Structured Receipt Layout */}
            <div id="printable-receipt" className="border border-border rounded-card bg-surface-sunken p-5 font-mono text-xs space-y-4">
              <div className="text-center space-y-1">
                <h3 className="font-extrabold text-sm text-ink uppercase">{restaurantName}</h3>
                <p className="text-ink-muted text-[10px]">{restaurantAddress}</p>
                {restaurantEmail && <p className="text-ink-muted text-[10px]">Email: {restaurantEmail}</p>}
                <div className="border-b border-dashed border-border py-1" />
              </div>

              <div className="space-y-1 text-ink-muted">
                <div className="flex justify-between">
                  <span>Invoice ID:</span>
                  <span className="font-semibold text-ink truncate max-w-[180px]">{receipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dining Table:</span>
                  <span className="font-semibold text-ink uppercase">{receipt.tableName}</span>
                </div>
                {receipt.tag && (
                  <div className="flex justify-between">
                    <span>Guest Tag:</span>
                    <span className="font-semibold text-ink truncate max-w-[180px]">{receipt.tag}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span className="font-semibold text-ink uppercase">{receipt.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Settle Mode:</span>
                  <span className="font-semibold text-ink">{receipt.paymentType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Closed At:</span>
                  <span>{new Date(receipt.openedAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 border-t border-b border-dashed border-border py-3">
                {receipt.items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.name} x{item.qty}</span>
                    <span>Rs. {(Number(item.unitPrice) * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Invoice Totals */}
              <div className="space-y-1 text-right text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal</span>
                  <span>Rs. {receipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Discount</span>
                  <span>Rs. -{receipt.discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-primary text-sm border-t border-border/40 pt-1.5">
                  <span>Total Settled</span>
                  <span>Rs. {receipt.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-border" />
              {welcomeNote && (
                <div className="text-center text-[10px] text-ink-muted italic pt-1 select-none">
                  {welcomeNote}
                </div>
              )}
              <div className="text-center text-[10px] text-ink-muted italic pt-1 select-none">
                {thankYouNote}
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              {isQzConnected && receptionPrinter ? (
                <button
                  type="button"
                  onClick={() => {
                    if (receipt) printReceipt(receptionPrinter, receipt);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-control hover:bg-primary-hover transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Thermal Bill</span>
                </button>
              ) : (
                <span className="text-[10px] text-warning font-semibold italic flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Printer bridge disconnected (Fallback to browser print)</span>
                </span>
              )}

              <button
                type="button"
                onClick={handleBrowserPrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-border border border-border text-ink-muted hover:text-ink text-xs font-semibold rounded-control transition-colors"
              >
                <Printer className="h-4 w-4" />
                <span>Browser Print</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
