"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useQzTray } from "@/hooks/use-qz-tray";
import { PageHeader } from "@/components/ui/page-header";
import { getMenuItemImage } from "@/lib/menu-images";
import { Modal } from "@/components/ui/modal-sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { CustomerCreditSyncWidget } from "@/components/ui/customer-credit-sync";
import { Plus, Minus, Trash2, ShoppingCart, Loader2, Printer, XCircle, AlertTriangle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  isKitchen: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  price: string;
  categoryId: string;
  imageUrl?: string | null;
}

interface MenuData {
  categories: Category[];
  menuItems: MenuItem[];
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

export default function PosPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  // POS State Parameters
  const [selectedCatId, setSelectedCatId] = useState<string>("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentType, setPaymentType] = useState<"CASH" | "CARD" | "CREDIT">("CASH");
  const [discount, setDiscount] = useState<number>(0);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Receipt Modal State
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Printer mapping configurations & hooks
  const [receptionPrinter, setReceptionPrinter] = useState("");
  const [restaurantName, setRestaurantName] = useState("JD Sekuwa House");
  const [restaurantAddress, setRestaurantAddress] = useState("Lalitpur, Nepal");
  const [restaurantEmail, setRestaurantEmail] = useState("");
  const [welcomeNote, setWelcomeNote] = useState("");
  const [thankYouNote, setThankYouNote] = useState("Thank you for dining with us!");

  const { isConnected: isQzConnected, printReceipt } = useQzTray();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("jd_sekuwa_printers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
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

  // 1. Fetch Categories & Menu Items for grid
  const { data: menuData, isLoading: isMenuLoading } = useQuery<MenuData>({
    queryKey: ["pos-menu"],
    queryFn: async () => {
      const res = await fetch("/api/pos/menu");
      if (!res.ok) throw new Error("Failed to load POS menu items");
      return res.json();
    }
  });

  // 2. Fetch receipt print payload for checked out sale
  const { data: receipt, isLoading: isReceiptLoading, refetch: refetchReceipt } = useQuery<ReceiptPayload>({
    queryKey: ["receipt", receiptSaleId],
    queryFn: async () => {
      const res = await fetch(`/api/pos/receipt/${receiptSaleId}`);
      if (!res.ok) throw new Error("Failed to fetch receipt details");
      return res.json();
    },
    enabled: !!receiptSaleId
  });

  // 3. Mutation: Checkout quick sale
  const checkoutMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/pos/quick-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Checkout failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      // Clear cart & variables
      setCart([]);
      setDiscount(0);
      setCustomerName("");
      setPhone("");
      setCheckoutError(null);
      // Load receipt
      setReceiptSaleId(data.id);
      setReceiptModalOpen(true);

      // Auto-print receipt if printer bridge connected
      if (isQzConnected && receptionPrinter) {
        fetch(`/api/pos/receipt/${data.id}`)
          .then(res => res.json())
          .then(receiptPayload => {
            printReceipt(receptionPrinter, receiptPayload);
          })
          .catch(err => console.warn("[Receipt print failed]:", err.message));
      }
    },
    onError: (err: any) => {
      setCheckoutError(err.message || "Failed to process sale");
    }
  });

  // 4. Mutation: Void OrderItem
  const voidMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/order-items/${itemId}/void`, {
        method: "POST"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Void failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      refetchReceipt();
    }
  });

  // Cart helper functions
  const handleAddToCart = (item: MenuItem) => {
    const priceNum = parseFloat(item.price);
    const existing = cart.find((i) => i.menuItemId === item.id);
    if (existing) {
      setCart(
        cart.map((i) =>
          i.menuItemId === item.id ? { ...i, qty: i.qty + 1 } : i
        )
      );
    } else {
      setCart([...cart, { menuItemId: item.id, name: item.name, price: priceNum, qty: 1 }]);
    }
  };

  const handleUpdateQty = (menuItemId: string, delta: number) => {
    const item = cart.find((i) => i.menuItemId === menuItemId);
    if (!item) return;

    const nextQty = item.qty + delta;
    if (nextQty <= 0) {
      setCart(cart.filter((i) => i.menuItemId !== menuItemId));
    } else {
      setCart(
        cart.map((i) =>
          i.menuItemId === menuItemId ? { ...i, qty: nextQty } : i
        )
      );
    }
  };

  const handleRemoveFromCart = (menuItemId: string) => {
    setCart(cart.filter((i) => i.menuItemId !== menuItemId));
  };

  // Math Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = Math.max(0, subtotal - (isAdmin ? discount : 0));

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setCheckoutError("Cart is currently empty.");
      return;
    }

    if (paymentType === "CREDIT" && (!customerName || !phone)) {
      setCheckoutError("Customer name and phone are required for CREDIT settlements.");
      return;
    }

    setCheckoutError(null);
    checkoutMutation.mutate({
      items: cart.map((i) => ({ menuItemId: i.menuItemId, qty: i.qty })),
      paymentType,
      discount: isAdmin ? discount : 0,
      customerInfo: customerName && phone ? { customerName, phone } : undefined
    });
  };

  const categories = menuData?.categories || [];
  const menuItems = menuData?.menuItems || [];

  // Filter items by category tab selection AND search query
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCatId === "ALL" || item.categoryId === selectedCatId;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const itemsPerPage = 9;
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="space-y-6">
      <PageHeader
        title="POS Checkout Counter"
        description="Compile register transactions for walk-in orders instantly."
      />

      {isMenuLoading ? (
        <div className="flex h-[40vh] w-full items-center justify-center text-primary">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          
          {/* LEFT: Category Tabs and Items Grid */}
          <div className="flex-1 space-y-4">
            
            {/* Category tabs scroll */}
            <div className="flex gap-2 overflow-x-auto pb-2 border-b border-border scrollbar-none">
              <button
                onClick={() => { setSelectedCatId("ALL"); setCurrentPage(1); }}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors select-none",
                  selectedCatId === "ALL"
                    ? "bg-primary text-white"
                    : "bg-surface-sunken text-ink-muted hover:bg-border"
                )}
              >
                All Items
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCatId(cat.id); setCurrentPage(1); }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors select-none",
                    selectedCatId === cat.id
                      ? "bg-primary text-white"
                      : "bg-surface-sunken text-ink-muted hover:bg-border"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-control border border-border px-3.5 py-2 pl-9 text-xs text-ink bg-white outline-none focus:border-primary placeholder:text-ink-muted/50"
              />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-muted/50" />
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {paginatedItems.map((item) => {
                const inCart = cart.find((i) => i.menuItemId === item.id);
                const categoryObj = categories.find((c) => c.id === item.categoryId);
                const categoryName = categoryObj ? categoryObj.name : "";
                const imageUrl = item.imageUrl || getMenuItemImage(item.name, categoryName);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className={cn(
                      "group rounded-card border overflow-hidden bg-card hover:shadow-lg cursor-pointer flex flex-col justify-between h-[190px] transition-all duration-300 relative select-none transform active:scale-[0.98]",
                      inCart
                        ? "border-primary ring-1 ring-primary/20 shadow-sm"
                        : "border-border hover:border-border-hover"
                    )}
                  >
                    {/* Visual Card Image Header */}
                    <div className="h-[105px] w-full relative overflow-hidden bg-surface-sunken">
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
                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      <h4 className="font-extrabold text-ink text-xs line-clamp-1 leading-tight group-hover:text-primary transition-colors duration-200" title={item.name}>
                        {item.name}
                      </h4>
                      <div className="flex items-center justify-between mt-2 select-none">
                        <span className="text-xs font-black text-ink font-mono tabular-nums">
                          Rs. {Number(item.price).toFixed(0)}
                        </span>
                        
                        <span className={cn(
                          "h-6 px-2.5 rounded-control flex items-center gap-1 text-[10px] font-black shrink-0 transition-colors duration-200",
                          inCart
                            ? "bg-primary text-white"
                            : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white"
                        )}>
                          <Plus className="h-3 w-3 shrink-0" />
                          <span>Add</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4 select-none">
                <span className="text-[10px] font-bold text-ink-muted">
                  Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} items
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 rounded-control bg-surface-sunken border border-border text-[10px] font-bold text-ink hover:bg-border disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={cn(
                        "h-6 w-6 rounded-control text-[10px] font-bold transition-colors",
                        currentPage === p
                          ? "bg-primary text-white font-black"
                          : "bg-surface-sunken border border-border text-ink hover:bg-border"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 rounded-control bg-surface-sunken border border-border text-[10px] font-bold text-ink hover:bg-border disabled:opacity-50 transition-colors disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Active Order Cart Column */}
          <div className="w-full lg:w-[360px] rounded-card border border-border bg-card p-5 flex flex-col h-[650px] shadow-sm shrink-0">
            <div className="flex items-center gap-2 border-b border-border pb-3 select-none">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-ink text-sm">Active Cart</h3>
              <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                {cart.reduce((sum, i) => sum + i.qty, 0)} items
              </span>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-thin">
              {cart.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex justify-between items-start text-xs border-b border-border/50 pb-3"
                >
                  <div className="space-y-0.5 max-w-[170px]">
                    <h5 className="font-bold text-ink truncate">{item.name}</h5>
                    <span className="text-ink-muted font-mono tabular-nums">
                      Rs. {item.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleUpdateQty(item.menuItemId, -1)}
                      className="h-6 w-6 rounded-control bg-surface-sunken hover:bg-border text-ink flex items-center justify-center transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-bold text-ink w-4 text-center tabular-nums">{item.qty}</span>
                    <button
                      onClick={() => handleUpdateQty(item.menuItemId, 1)}
                      className="h-6 w-6 rounded-control bg-surface-sunken hover:bg-border text-ink flex items-center justify-center transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleRemoveFromCart(item.menuItemId)}
                      className="p-1 text-ink-muted hover:text-danger rounded-control transition-colors ml-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center py-12 text-ink-muted text-xs italic select-none">
                  Select menu items on the left to populate the checkout cart.
                </div>
              )}
            </div>

            {/* Checkout Form Options */}
            <form onSubmit={handleCheckoutSubmit} className="border-t border-border pt-4 space-y-4">
              
              {/* Payment Type Selection */}
              <div>
                <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1.5">
                  Payment Method
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

              {/* Customer Inputs (Names/Phones) */}
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

              {/* Customer Credit Sync & Balance Alert */}
              {phone.trim().length >= 3 && (
                <CustomerCreditSyncWidget
                  phone={phone}
                  onCustomerFound={({ customerName: foundName }) => {
                    if (!customerName && foundName) {
                      setCustomerName(foundName);
                    }
                  }}
                />
              )}


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
                        className="w-20 rounded-control border border-border px-2 py-0.5 text-right font-mono text-xs text-ink outline-none focus:border-primary"
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
                  <span className="text-primary tabular-nums">Rs. {total.toFixed(2)}</span>
                </div>
              </div>

              {checkoutError && (
                <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-[11px] text-danger">
                  {checkoutError}
                </div>
              )}

              <button
                type="submit"
                disabled={checkoutMutation.isPending || cart.length === 0}
                className="w-full rounded-control bg-primary text-white py-2.5 text-xs font-semibold shadow-md shadow-primary/20 hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                {checkoutMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Settle & Checkout</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECEIPT VIEW & VOID PANEL */}
      <Modal
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptSaleId(null);
        }}
        title="Payment Successful — Sales Receipt"
        footer={
          <>
            <button
              onClick={() => {
                setReceiptModalOpen(false);
                setReceiptSaleId(null);
              }}
              className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-colors"
            >
              Done & Close
            </button>
          </>
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
                  <span>Receipt ID:</span>
                  <span className="font-semibold text-ink truncate max-w-[180px]">{receipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span className="font-semibold text-ink uppercase">{receipt.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Type:</span>
                  <span className="font-semibold text-ink">{receipt.paymentType}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(receipt.openedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-border" />

              {/* Items Listing */}
              <div className="space-y-2">
                <div className="flex font-bold text-ink">
                  <span className="flex-1">Item Name</span>
                  <span className="w-12 text-center">Qty</span>
                  <span className="w-20 text-right">Price</span>
                </div>
                {receipt.items.map((item) => (
                  <div key={item.id} className="flex text-ink-muted items-center justify-between">
                    <div className="flex-1 truncate pr-2">{item.name}</div>
                    <div className="w-12 text-center">{item.qty}</div>
                    <div className="w-20 text-right">{(item.unitPrice * item.qty).toFixed(2)}</div>
                    
                    {/* Void Item option */}
                    <button
                      disabled={voidMutation.isPending}
                      onClick={() => {
                        if (confirm(`Are you sure you want to void '${item.name}'?`)) {
                          voidMutation.mutate(item.id);
                        }
                      }}
                      className="p-1 hover:text-danger text-ink-muted/50 transition-colors ml-2"
                      title="Void this item"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-border" />

              {/* Totals */}
              <div className="space-y-1.5 text-ink">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>Rs. {receipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-ink-muted">
                  <span>Discount</span>
                  <span>Rs. -{receipt.discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-primary text-sm border-t border-border/40 pt-1.5">
                  <span>Total Bill</span>
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
