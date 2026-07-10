"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal-sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import { Bed, UserPlus, LogOut, Coffee, Plus, Minus, Loader2, DollarSign, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
}

interface ActiveStay {
  id: string;
  guestName: string;
  phone: string;
  idProof: string;
  numGuests: number;
  checkIn: string;
  expectedCheckOut: string;
  numNights: number;
  orderItems: OrderItem[];
  stayTotal: number | null;
}

interface Room {
  id: string;
  name: string;
  status: "VACANT" | "OCCUPIED";
  nightlyRate: number | null;
  activeStay: ActiveStay | null;
}

interface MenuItem {
  id: string;
  name: string;
  price: string;
  categoryId: string;
}

interface Category {
  id: string;
  name: string;
}

interface MenuData {
  categories: Category[];
  menuItems: MenuItem[];
}

export default function RoomsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  // Selected Room stays states
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  
  // Modals visibility toggles
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);

  // Form states - Check In
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [idProof, setIdProof] = useState("");
  const [numGuests, setNumGuests] = useState(1);
  const [expectedCheckOut, setExpectedCheckOut] = useState("");
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Form states - Service Charge (POS Grid reuse)
  const [selectedCatId, setSelectedCatId] = useState("ALL");
  const [chargeQty, setChargeQty] = useState(1);
  const [chargeError, setChargeError] = useState<string | null>(null);

  // Form states - Checkout
  const [paymentType, setPaymentType] = useState<"CASH" | "CARD" | "CREDIT">("CASH");
  const [checkOutError, setCheckOutError] = useState<string | null>(null);

  // 1. Fetch Rooms list
  const { data: rooms = [], isLoading: isRoomsLoading } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms");
      if (!res.ok) throw new Error("Failed to load rooms list");
      return res.json();
    }
  });

  // 2. Fetch POS Menu items (reused for Charge to Room panel)
  const { data: menuData } = useQuery<MenuData>({
    queryKey: ["pos-menu"],
    queryFn: async () => {
      const res = await fetch("/api/pos/menu");
      if (!res.ok) throw new Error("Failed to load menu");
      return res.json();
    }
  });

  // 3. Mutation: Guest Check In
  const checkInMutation = useMutation({
    mutationFn: async ({ roomId, payload }: { roomId: string; payload: any }) => {
      const res = await fetch(`/api/rooms/${roomId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Check-in failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCheckInOpen(false);
      setSelectedRoom(null);
      // Reset forms
      setGuestName("");
      setPhone("");
      setIdProof("");
      setNumGuests(1);
      setExpectedCheckOut("");
      setCheckInError(null);
    },
    onError: (err: any) => {
      setCheckInError(err.message || "Failed to process check-in");
    }
  });

  // 4. Mutation: Add room charge
  const chargeMutation = useMutation({
    mutationFn: async ({ stayId, menuItemId, qty }: { stayId: string; menuItemId: string; qty: number }) => {
      const res = await fetch(`/api/rooms/stay/${stayId}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId, qty })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to post charge");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setChargeQty(1);
      setChargeError(null);
      // Update selected room state to refresh on-screen item totals
      if (selectedRoom) {
        const updated = rooms.find((r) => r.id === selectedRoom.id);
        if (updated) setSelectedRoom(updated);
      }
    },
    onError: (err: any) => {
      setChargeError(err.message || "Failed to post charge");
    }
  });

  // 5. Mutation: Guest Check Out
  const checkOutMutation = useMutation({
    mutationFn: async ({ stayId, paymentType }: { stayId: string; paymentType: string }) => {
      const res = await fetch(`/api/rooms/stay/${stayId}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Checkout failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setCheckOutOpen(false);
      setSelectedRoom(null);
      setPaymentType("CASH");
      setCheckOutError(null);
    },
    onError: (err: any) => {
      setCheckOutError(err.message || "Checkout failed");
    }
  });

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;

    if (!expectedCheckOut) {
      setCheckInError("Please choose a valid checkout date.");
      return;
    }

    setCheckInError(null);
    checkInMutation.mutate({
      roomId: selectedRoom.id,
      payload: {
        guestName,
        phone,
        idProof,
        numGuests,
        expectedCheckOut: new Date(expectedCheckOut).toISOString()
      }
    });
  };

  const handlePostCharge = (menuItemId: string) => {
    if (!selectedRoom?.activeStay) return;
    if (chargeQty <= 0) {
      setChargeError("Please specify a positive quantity.");
      return;
    }

    setChargeError(null);
    chargeMutation.mutate({
      stayId: selectedRoom.activeStay.id,
      menuItemId,
      qty: chargeQty
    });
  };

  const handleCheckOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom?.activeStay) return;

    setCheckOutError(null);
    checkOutMutation.mutate({
      stayId: selectedRoom.activeStay.id,
      paymentType
    });
  };

  const menuItems = menuData?.menuItems || [];
  const categories = menuData?.categories || [];

  // Filter menu items by categories
  const filteredMenuItems = menuItems.filter((item) => {
    if (selectedCatId === "ALL") return true;
    return item.categoryId === selectedCatId;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms & Lodging Overview"
        description="Monitor room stay statuses, check guests in, post service charges, and process checkout billings."
      />

      {isRoomsLoading ? (
        <div className="flex h-[35vh] w-full items-center justify-center text-primary">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-card border border-border bg-card p-6 flex flex-col justify-between h-[280px] shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
            >
              {/* Top Header Card info */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-ink text-lg">{room.name}</h4>
                    <StatusBadge status={room.status} />
                  </div>
                  {room.nightlyRate !== null && (
                    <p className="text-xs text-ink-muted">
                      Rate: <span className="font-semibold text-ink tabular-nums">Rs. {room.nightlyRate.toFixed(2)}</span> / night
                    </p>
                  )}
                </div>
                <Bed className={cn("h-6 w-6", room.status === "OCCUPIED" ? "text-primary" : "text-ink-muted/30")} />
              </div>

              {/* Guest stayed details */}
              <div className="mt-4 flex-1 border-t border-border/40 pt-4">
                {room.activeStay ? (
                  <div className="text-xs space-y-1.5 text-ink-muted leading-relaxed">
                    <p>Guest: <strong className="text-ink">{room.activeStay.guestName}</strong></p>
                    <p>Phone: <span className="font-mono text-ink">{room.activeStay.phone}</span></p>
                    <p>Nights: <span className="font-semibold text-ink">{room.activeStay.numNights} Nights</span></p>
                    {room.activeStay.stayTotal !== null && (
                      <p className="text-sm font-bold text-ink mt-2">
                        Total Due: <span className="text-primary font-mono tabular-nums">Rs. {room.activeStay.stayTotal.toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted italic py-2">No active stays. Ready for check-in.</p>
                )}
              </div>

              {/* Bottom buttons actions */}
              <div className="flex gap-2 mt-6">
                {room.status === "VACANT" ? (
                  <button
                    onClick={() => {
                      setSelectedRoom(room);
                      setCheckInOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover active:scale-[0.99] transition-all"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Check In Guest</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSelectedRoom(room);
                        setChargeOpen(true);
                      }}
                      className="flex-1 px-3 py-2 bg-surface-sunken hover:bg-border text-ink-muted hover:text-ink text-xs font-semibold rounded-control transition-colors"
                    >
                      Service Charge
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRoom(room);
                        setCheckOutOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-danger text-white text-xs font-semibold rounded-control shadow-sm hover:bg-danger/90 active:scale-[0.99] transition-all"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Check Out</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: CHECK IN FORM */}
      <Modal
        isOpen={checkInOpen}
        onClose={() => {
          setCheckInOpen(false);
          setSelectedRoom(null);
          setCheckInError(null);
        }}
        title={`Check In Guest — ${selectedRoom?.name || ""}`}
        footer={
          <>
            <button
              onClick={() => setCheckInOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="checkin-form"
              disabled={checkInMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {checkInMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Register Guest</span>
            </button>
          </>
        }
      >
        <form id="checkin-form" onSubmit={handleCheckInSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1">Guest Name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Name"
                required
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                required
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1">ID Proof Document</label>
              <input
                type="text"
                value={idProof}
                onChange={(e) => setIdProof(e.target.value)}
                placeholder="Passport / Citizenship No."
                required
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1">Number of Guests</label>
              <input
                type="number"
                min="1"
                value={numGuests}
                onChange={(e) => setNumGuests(parseInt(e.target.value) || 1)}
                required
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-muted uppercase mb-1">Expected Check-out Date</label>
            <input
              type="datetime-local"
              value={expectedCheckOut}
              onChange={(e) => setExpectedCheckOut(e.target.value)}
              required
              className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary"
            />
          </div>

          {checkInError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
              {checkInError}
            </div>
          )}
        </form>
      </Modal>

      {/* MODAL 2: CHARGE TO ROOM (POS MENU GRID REUSE) */}
      <Modal
        isOpen={chargeOpen}
        onClose={() => {
          setChargeOpen(false);
          setSelectedRoom(null);
          setChargeError(null);
        }}
        title={`Add Service Charge — ${selectedRoom?.name || ""}`}
        className="max-w-2xl"
        footer={
          <button
            onClick={() => setChargeOpen(false)}
            className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-colors"
          >
            Done & Close
          </button>
        }
      >
        <div className="space-y-5">
          <div className="flex gap-4">
            {/* Category selection */}
            <div className="w-1/3 border-r border-border pr-3 space-y-1.5 overflow-y-auto max-h-[300px]">
              <button
                onClick={() => setSelectedCatId("ALL")}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-control text-xs font-semibold transition-colors select-none",
                  selectedCatId === "ALL" ? "bg-primary text-white" : "bg-transparent text-ink-muted hover:bg-surface-sunken"
                )}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-control text-xs font-semibold transition-colors select-none",
                    selectedCatId === cat.id ? "bg-primary text-white" : "bg-transparent text-ink-muted hover:bg-surface-sunken"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Items Selector Grid */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-ink-muted uppercase">Quantity to add:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setChargeQty(Math.max(1, chargeQty - 1))}
                    className="h-6 w-6 rounded-control bg-surface-sunken border border-border flex items-center justify-center"
                  >
                    <Minus className="h-3 w-3 text-ink" />
                  </button>
                  <span className="text-xs font-bold text-ink w-6 text-center tabular-nums">{chargeQty}</span>
                  <button
                    onClick={() => setChargeQty(chargeQty + 1)}
                    className="h-6 w-6 rounded-control bg-surface-sunken border border-border flex items-center justify-center"
                  >
                    <Plus className="h-3 w-3 text-ink" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handlePostCharge(item.id)}
                    className="rounded-control border border-border p-2.5 bg-white hover:bg-surface-sunken hover:border-primary/40 cursor-pointer flex flex-col justify-between h-[80px] transition-all relative select-none"
                  >
                    <h5 className="font-bold text-ink text-[11px] line-clamp-1">{item.name}</h5>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-ink-muted font-mono tabular-nums">Rs. {parseFloat(item.price).toFixed(2)}</span>
                      {chargeMutation.isPending && selectedRoom?.activeStay && (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {chargeError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2 text-xs text-danger">
              {chargeError}
            </div>
          )}

          {/* Current Stays items list summary */}
          {selectedRoom?.activeStay && (
            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-bold text-ink uppercase mb-2">Charged Room Service Items</h4>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                {selectedRoom.activeStay.orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-ink-muted font-mono">
                    <span>{item.name} x {item.qty}</span>
                    <span>Rs. {item.total.toFixed(2)}</span>
                  </div>
                ))}
                {selectedRoom.activeStay.orderItems.length === 0 && (
                  <p className="text-xs text-ink-muted italic py-1">No items currently charged to this room.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 3: CHECK OUT FORM */}
      <Modal
        isOpen={checkOutOpen}
        onClose={() => {
          setCheckOutOpen(false);
          setSelectedRoom(null);
          setCheckOutError(null);
        }}
        title={`Check Out Stay — ${selectedRoom?.name || ""}`}
        footer={
          <>
            <button
              onClick={() => setCheckOutOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="checkout-form"
              disabled={checkOutMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-xs font-semibold rounded-control shadow-sm hover:bg-danger/90 disabled:opacity-50 transition-colors"
            >
              {checkOutMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Settle & Checkout</span>
            </button>
          </>
        }
      >
        {selectedRoom?.activeStay && (
          <form id="checkout-form" onSubmit={handleCheckOutSubmit} className="space-y-6">
            
            {/* Stay Cost Breakdown */}
            <div className="rounded-card border border-border bg-surface-sunken p-4 space-y-2.5">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wide">Stay Billing Summary</h4>
              <div className="text-xs space-y-1.5 text-ink-muted font-mono">
                <div className="flex justify-between">
                  <span>Guest Name:</span>
                  <span className="font-sans font-bold text-ink">{selectedRoom.activeStay.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>{selectedRoom.activeStay.numNights} Nights</span>
                </div>
                
                {selectedRoom.nightlyRate !== null && (
                  <div className="flex justify-between border-t border-border/40 pt-1.5">
                    <span>Lodging nights charges:</span>
                    <span className="text-ink">Rs. {(selectedRoom.nightlyRate * selectedRoom.activeStay.numNights).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Food & Service charges:</span>
                  <span className="text-ink">
                    Rs. {selectedRoom.activeStay.orderItems.reduce((sum, i) => sum + i.total, 0).toFixed(2)}
                  </span>
                </div>

                {selectedRoom.activeStay.stayTotal !== null && (
                  <div className="flex justify-between text-sm font-bold text-ink border-t border-border/60 pt-2">
                    <span>Total Bill:</span>
                    <span className="text-primary">Rs. {selectedRoom.activeStay.stayTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                Settlement Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["CASH", "CARD", "CREDIT"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    className={cn(
                      "py-2 rounded-control text-xs font-semibold border transition-all text-center select-none",
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

            {checkOutError && (
              <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
                {checkOutError}
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
