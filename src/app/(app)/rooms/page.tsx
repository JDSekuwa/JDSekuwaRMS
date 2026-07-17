"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { Modal } from "@/components/ui/modal-sheet";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Bed,
  UserPlus,
  LogOut,
  Coffee,
  Plus,
  Minus,
  Loader2,
  DollarSign,
  Calendar,
  Phone,
  Users,
  Hash,
  CreditCard,
  Sparkles,
  Clock,
  Star,
  Trash2,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────────────────────── TYPES ───────────────────────────── */

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
  imageUrl?: string | null;
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

/* Curated hotel room ambient images — rotated per room index */
const HOTEL_IMAGES = [
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
  "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80",
  "https://images.unsplash.com/photo-1562778612-e1e0cda9915c?w=800&q=80",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&q=80",
];

/* ═══════════════════════════ COMPONENT ══════════════════════════ */

export default function RoomsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);

  // Form states — Check In
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [idProof, setIdProof] = useState("");
  const [numGuests, setNumGuests] = useState(1);
  const [expectedCheckOut, setExpectedCheckOut] = useState("");
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Form states — Service Charge
  const [selectedCatId, setSelectedCatId] = useState("ALL");
  const [chargeQty, setChargeQty] = useState(1);
  const [chargeError, setChargeError] = useState<string | null>(null);

  // Form states — Checkout
  const [paymentType, setPaymentType] = useState<"CASH" | "CARD" | "CREDIT">("CASH");
  const [checkOutError, setCheckOutError] = useState<string | null>(null);

  // Manage Rooms states
  const [manageRoomsOpen, setManageRoomsOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomRate, setNewRoomRate] = useState<number>(0);
  const [newRoomImageUrl, setNewRoomImageUrl] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState("");
  const [editingRoomRate, setEditingRoomRate] = useState<number>(0);
  const [editingRoomImageUrl, setEditingRoomImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const handleImageUpload = async (file: File, type: "new" | "edit") => {
    setUploadingImage(true);
    setRoomsError(null);
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
        setNewRoomImageUrl(data.url);
      } else {
        setEditingRoomImageUrl(data.url);
      }
    } catch (err: any) {
      setRoomsError(err.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  };

  /* ── QUERIES ──────────────────────────────────────────────────── */

  const { data: rooms = [], isLoading: isRoomsLoading } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await fetch("/api/rooms");
      if (!res.ok) throw new Error("Failed to load rooms list");
      return res.json();
    }
  });

  const { data: menuData } = useQuery<MenuData>({
    queryKey: ["pos-menu"],
    queryFn: async () => {
      const res = await fetch("/api/pos/menu");
      if (!res.ok) throw new Error("Failed to load menu");
      return res.json();
    }
  });

  /* ── MUTATIONS ────────────────────────────────────────────────── */

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
      setGuestName(""); setPhone(""); setIdProof(""); setNumGuests(1); setExpectedCheckOut(""); setCheckInError(null);
    },
    onError: (err: any) => setCheckInError(err.message || "Failed to process check-in")
  });

  const chargeMutation = useMutation({
    mutationFn: async ({ stayId, menuItemId, qty }: { stayId: string; menuItemId: string; qty: number }) => {
      const res = await fetch(`/api/rooms/stay/${stayId}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId, qty })
      });
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || "Failed to post charge"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setChargeQty(1); setChargeError(null);
      if (selectedRoom) {
        const updated = rooms.find((r) => r.id === selectedRoom.id);
        if (updated) setSelectedRoom(updated);
      }
    },
    onError: (err: any) => setChargeError(err.message || "Failed to post charge")
  });

  const checkOutMutation = useMutation({
    mutationFn: async ({ stayId, paymentType }: { stayId: string; paymentType: string }) => {
      const res = await fetch(`/api/rooms/stay/${stayId}/check-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType })
      });
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.error || "Checkout failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setCheckOutOpen(false); setSelectedRoom(null); setPaymentType("CASH"); setCheckOutError(null);
    },
    onError: (err: any) => setCheckOutError(err.message || "Checkout failed")
  });

  // Create, Update, Delete Room mutations
  const createRoomMutation = useMutation({
    mutationFn: async (payload: { name: string; nightlyRate: number; imageUrl?: string | null }) => {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create room");
      }
      return res.json();
    },
    onSuccess: () => {
      setNewRoomName("");
      setNewRoomRate(0);
      setNewRoomImageUrl("");
      setRoomsError(null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => setRoomsError(err.message)
  });

  const updateRoomMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { name: string; nightlyRate: number; imageUrl?: string | null } }) => {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update room");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditingRoomId(null);
      setEditingRoomName("");
      setEditingRoomRate(0);
      setEditingRoomImageUrl("");
      setRoomsError(null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => setRoomsError(err.message)
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rooms/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete room");
      }
      return res.json();
    },
    onSuccess: () => {
      setRoomsError(null);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => setRoomsError(err.message)
  });

  /* ── HANDLERS ─────────────────────────────────────────────────── */

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    if (!expectedCheckOut) { setCheckInError("Please choose a valid checkout date."); return; }
    setCheckInError(null);
    checkInMutation.mutate({
      roomId: selectedRoom.id,
      payload: { guestName, phone, idProof, numGuests, expectedCheckOut: new Date(expectedCheckOut).toISOString() }
    });
  };

  const handlePostCharge = (menuItemId: string) => {
    if (!selectedRoom?.activeStay) return;
    if (chargeQty <= 0) { setChargeError("Please specify a positive quantity."); return; }
    setChargeError(null);
    chargeMutation.mutate({ stayId: selectedRoom.activeStay.id, menuItemId, qty: chargeQty });
  };

  const handleCheckOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom?.activeStay) return;
    setCheckOutError(null);
    checkOutMutation.mutate({ stayId: selectedRoom.activeStay.id, paymentType });
  };

  const menuItems = menuData?.menuItems || [];
  const categories = menuData?.categories || [];
  const filteredMenuItems = menuItems.filter((item) => selectedCatId === "ALL" || item.categoryId === selectedCatId);

  // Floor metrics
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter((r) => r.status === "OCCUPIED").length;
  const vacantRooms = rooms.filter((r) => r.status === "VACANT").length;
  const occupancyPct = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  /* ── RENDER ───────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <PageHeader
        title="Rooms & Lodging Overview"
        description="Monitor room stay statuses, check guests in, post service charges, and process checkout billings."
        actions={
          isAdmin ? (
            <button
              onClick={() => setManageRoomsOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover transition-all duration-200 select-none active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              <span>Manage Rooms</span>
            </button>
          ) : undefined
        }
      />

      {/* STAT TILES */}
      {!isRoomsLoading && rooms.length > 0 && (
        <div className="animate-fade-in-up space-y-3">
          <div className="grid grid-cols-3 gap-3">

            {/* Total Rooms */}
            <div className="relative rounded-card overflow-hidden border border-border shadow-sm group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-20 group-hover:opacity-30 transition-opacity duration-500"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80')` }}
              />
              <div className="relative p-4 space-y-1 bg-gradient-to-br from-card/90 to-card/70">
                <p className="text-[9px] font-black text-ink-muted uppercase tracking-widest">Total Rooms</p>
                <p className="text-3xl font-black text-ink tabular-nums">{totalRooms}</p>
                <p className="text-[9px] font-bold text-ink-muted/60">In property</p>
              </div>
            </div>

            {/* Vacant */}
            <div className="relative rounded-card overflow-hidden border border-success/30 shadow-sm group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80')` }}
              />
              <div className="relative p-4 space-y-1 bg-gradient-to-br from-success/5 to-success/[0.02]">
                <p className="text-[9px] font-black text-success/80 uppercase tracking-widest">Vacant</p>
                <p className="text-3xl font-black text-success tabular-nums">{vacantRooms}</p>
                <p className="text-[9px] font-bold text-ink-muted/60">Ready to check-in</p>
              </div>
            </div>

            {/* Occupied */}
            <div className="relative rounded-card overflow-hidden border border-primary/30 shadow-sm group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-15 group-hover:opacity-25 transition-opacity duration-500"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&q=80')` }}
              />
              <div className="relative p-4 space-y-1 bg-gradient-to-br from-primary/5 to-primary/[0.02]">
                <p className="text-[9px] font-black text-primary/80 uppercase tracking-widest">Occupied</p>
                <p className="text-3xl font-black text-primary tabular-nums">{occupiedRooms}</p>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                  </span>
                  <p className="text-[9px] font-bold text-ink-muted/60">Active guests</p>
                </div>
              </div>
            </div>
          </div>

          {/* Slim occupancy bar */}
          <div className="rounded-card border border-border bg-card px-5 py-3 shadow-xs flex items-center gap-4">
            <Bed className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="flex-1 h-2 bg-surface-sunken rounded-full overflow-hidden flex">
              <div
                className="bg-primary h-full transition-all duration-700 ease-out rounded-l-full"
                style={{ width: `${occupancyPct}%` }}
              />
              <div
                className="bg-success h-full transition-all duration-700 ease-out rounded-r-full"
                style={{ width: `${100 - occupancyPct}%` }}
              />
            </div>
            <span className="text-[10px] font-black text-ink-muted tabular-nums shrink-0">{occupancyPct}% occupied</span>
          </div>
        </div>
      )}

      {/* ROOMS GRID */}
      {isRoomsLoading ? (
        <div className="flex h-[35vh] w-full items-center justify-center text-primary">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in-up [animation-delay:100ms]">
          {rooms.map((room, index) => {
            const isOccupied = room.status === "OCCUPIED";
            const bgImage = room.imageUrl || HOTEL_IMAGES[index % HOTEL_IMAGES.length];
            const stay = room.activeStay;

            return (
              <div
                key={room.id}
                className="group relative rounded-card overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-default"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Background hotel room photo */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                  style={{ backgroundImage: `url('${bgImage}')` }}
                />

                {/* Status-aware gradient scrim */}
                <div className={cn(
                  "absolute inset-0 transition-opacity duration-300",
                  isOccupied
                    ? "bg-gradient-to-t from-black/95 via-black/70 to-primary/20"
                    : "bg-gradient-to-t from-black/90 via-black/55 to-black/10"
                )} />

                {/* Status ring */}
                <div className={cn(
                  "absolute inset-0 rounded-card ring-inset transition-all duration-300",
                  isOccupied ? "ring-2 ring-primary/50" : "ring-1 ring-white/10 group-hover:ring-success/40"
                )} />

                {/* ── TOP HEADER ── */}
                <div className="relative z-10 p-4 flex items-start justify-between">
                  {/* Room name pill */}
                  <span className="inline-flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
                    <Bed className="h-2.5 w-2.5 opacity-70" />
                    {room.name}
                  </span>

                  {/* Status beacon pill */}
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border backdrop-blur-sm",
                    isOccupied
                      ? "bg-primary/20 border-primary/40 text-white"
                      : "bg-success/20 border-success/40 text-success"
                  )}>
                    <span className="relative flex h-1.5 w-1.5">
                      {isOccupied && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      )}
                      <span className={cn(
                        "relative inline-flex rounded-full h-1.5 w-1.5",
                        isOccupied ? "bg-primary" : "bg-success"
                      )} />
                    </span>
                    <span>{isOccupied ? "Occupied" : "Vacant"}</span>
                  </div>
                </div>

                {/* ── MIDDLE CONTENT ── */}
                <div className="relative z-10 px-4 pb-2 min-h-[120px] flex flex-col justify-end">
                  {stay ? (
                    <div className="space-y-2">
                      {/* Guest name */}
                      <p className="text-white font-extrabold text-base leading-tight truncate">{stay.guestName}</p>

                      {/* Metadata row */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1 text-white/60 text-[9px] font-bold">
                          <Phone className="h-2.5 w-2.5" /> {stay.phone}
                        </span>
                        <span className="flex items-center gap-1 text-white/60 text-[9px] font-bold">
                          <Users className="h-2.5 w-2.5" /> {stay.numGuests} Guest{stay.numGuests > 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1 text-white/60 text-[9px] font-bold">
                          <Clock className="h-2.5 w-2.5" /> {stay.numNights} Night{stay.numNights > 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Total due */}
                      {stay.stayTotal !== null && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-white/50 text-[9px] font-bold uppercase">Total Due</span>
                          <span className="text-white font-black text-lg tabular-nums tracking-tight drop-shadow-sm">
                            Rs. {stay.stayTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 pb-2">
                      <p className="text-white/40 text-[10px] font-medium italic">No active guests</p>
                      {room.nightlyRate !== null && (
                        <div className="flex items-center gap-1.5">
                          <Star className="h-3 w-3 text-warning/70" />
                          <span className="text-white/70 text-sm font-extrabold">
                            Rs. {room.nightlyRate.toLocaleString()} <span className="text-white/40 text-[10px] font-bold">/ night</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Nightly rate badge (occupied view) */}
                {isOccupied && room.nightlyRate !== null && (
                  <div className="relative z-10 px-4 pb-1">
                    <span className="text-white/35 text-[9px] font-bold">
                      Rs. {room.nightlyRate.toLocaleString()} / night
                    </span>
                  </div>
                )}

                {/* ── BOTTOM ACTION BUTTONS ── */}
                <div className="relative z-10 p-3 pt-2 flex gap-2">
                  {room.status === "VACANT" ? (
                    <button
                      onClick={() => { setSelectedRoom(room); setCheckInOpen(true); }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary/90 hover:bg-primary backdrop-blur-sm text-white text-[11px] font-black rounded-control shadow-lg hover:shadow-primary/40 active:scale-[0.98] transition-all duration-200 border border-primary/30"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Check In Guest</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { setSelectedRoom(room); setChargeOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-[10px] font-black rounded-control border border-white/15 transition-all duration-200"
                      >
                        <Coffee className="h-3.5 w-3.5 opacity-70" />
                        <span>Service Charge</span>
                      </button>
                      <button
                        onClick={() => { setSelectedRoom(room); setCheckOutOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-danger/80 hover:bg-danger backdrop-blur-sm text-white text-[10px] font-black rounded-control border border-danger/30 shadow-lg transition-all duration-200 active:scale-[0.98]"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Check Out</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FOR ROOMS MANAGEMENT */}
      <Modal
        isOpen={manageRoomsOpen}
        onClose={() => {
          setManageRoomsOpen(false);
          setEditingRoomId(null);
          setNewRoomName("");
          setNewRoomRate(0);
          setNewRoomImageUrl("");
          setRoomsError(null);
        }}
        title="Manage Lodging Rooms"
        className="max-w-3xl"
        footer={
          <button
            onClick={() => {
              setManageRoomsOpen(false);
              setEditingRoomId(null);
              setNewRoomName("");
              setNewRoomRate(0);
              setNewRoomImageUrl("");
              setRoomsError(null);
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
                {editingRoomId ? "Edit Room Details" : "Add New Room"}
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                    Room Designation / Name
                  </label>
                  <input
                    type="text"
                    value={editingRoomId ? editingRoomName : newRoomName}
                    onChange={(e) => {
                      if (editingRoomId) setEditingRoomName(e.target.value);
                      else setNewRoomName(e.target.value);
                    }}
                    placeholder="e.g. Room 104, Deluxe Suite B"
                    className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary bg-card"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                    Nightly Rate (NPR)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingRoomId ? editingRoomRate || "" : newRoomRate || ""}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) || 0;
                      if (editingRoomId) setEditingRoomRate(rate);
                      else setNewRoomRate(rate);
                    }}
                    placeholder="e.g. 2500"
                    className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary bg-card"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
                    Room Image (Optional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, editingRoomId ? "edit" : "new");
                      }}
                      className="w-full text-xs text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:text-[11px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
                    />
                    {uploadingImage && (
                      <div className="flex items-center gap-1.5 text-[10px] text-primary font-semibold">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Uploading image to server...</span>
                      </div>
                    )}
                    {(editingRoomId ? editingRoomImageUrl : newRoomImageUrl) && (
                      <div className="relative h-20 w-32 rounded-control overflow-hidden border border-border mt-1.5">
                        <img
                          src={editingRoomId ? editingRoomImageUrl : newRoomImageUrl}
                          alt="Room preview"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingRoomId) setEditingRoomImageUrl("");
                            else setNewRoomImageUrl("");
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
                  {editingRoomId ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (!editingRoomName || editingRoomRate <= 0) return;
                          updateRoomMutation.mutate({
                            id: editingRoomId,
                            payload: { name: editingRoomName, nightlyRate: editingRoomRate, imageUrl: editingRoomImageUrl || null }
                          });
                        }}
                        disabled={updateRoomMutation.isPending || uploadingImage}
                        className="flex-1 py-2 bg-primary text-white font-bold rounded-control hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {updateRoomMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        Save Edits
                      </button>
                      <button
                        onClick={() => {
                          setEditingRoomId(null);
                          setEditingRoomName("");
                          setEditingRoomRate(0);
                          setEditingRoomImageUrl("");
                        }}
                        className="px-3 py-2 bg-surface-sunken hover:bg-border text-ink font-semibold rounded-control transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!newRoomName || newRoomRate <= 0) return;
                        createRoomMutation.mutate({
                          name: newRoomName,
                          nightlyRate: newRoomRate,
                          imageUrl: newRoomImageUrl || null
                        });
                      }}
                      disabled={createRoomMutation.isPending || uploadingImage}
                      className="w-full py-2 bg-primary text-white font-bold rounded-control hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {createRoomMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Add Room
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: LIST OF ROOMS */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-ink-muted uppercase tracking-wider">
                Existing Rooms ({rooms.length})
              </h4>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                {rooms.map((r) => {
                  const isDeletable = r.status === "VACANT" && !r.activeStay;

                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2.5 rounded-control border border-border bg-surface-sunken/45 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {r.imageUrl ? (
                          <img
                            src={r.imageUrl}
                            alt={r.name}
                            className="h-8 w-12 rounded-control object-cover border border-border"
                          />
                        ) : (
                          <div className="h-8 w-12 rounded-control bg-border/50 flex items-center justify-center text-ink-muted">
                            <Bed className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div>
                          <span className="font-extrabold text-ink">{r.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              r.status === "OCCUPIED" && "bg-info",
                              r.status === "VACANT" && "bg-success"
                            )} />
                            <span className="text-[9px] font-bold text-ink-muted uppercase tracking-wide">
                              {r.status}
                            </span>
                            <span className="text-[9px] font-bold text-primary font-mono ml-2">
                              Rs. {Number(r.nightlyRate).toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingRoomId(r.id);
                            setEditingRoomName(r.name);
                            setEditingRoomRate(Number(r.nightlyRate));
                            setEditingRoomImageUrl(r.imageUrl || "");
                          }}
                          className="p-1 text-ink-muted hover:text-primary transition-colors hover:bg-border rounded-control"
                          title="Edit Room"
                        >
                          <Plus className="h-3.5 w-3.5 rotate-45" />
                        </button>
                        <button
                          disabled={!isDeletable || deleteRoomMutation.isPending}
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete room '${r.name}'?`)) {
                              deleteRoomMutation.mutate(r.id);
                            }
                          }}
                          className="p-1 text-ink-muted hover:text-danger disabled:opacity-30 transition-colors hover:bg-border rounded-control"
                          title={isDeletable ? "Delete Room" : "Cannot delete occupied/stay room"}
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

          {roomsError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
              {roomsError}
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL 1: CHECK IN GUEST
      ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={checkInOpen}
        onClose={() => { setCheckInOpen(false); setSelectedRoom(null); setCheckInError(null); }}
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
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {checkInMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Register Guest</span>
            </button>
          </>
        }
      >
        <form id="checkin-form" onSubmit={handleCheckInSubmit} className="space-y-4">
          {/* Rate callout */}
          {selectedRoom?.nightlyRate !== null && (
            <div className="rounded-control bg-primary/8 border border-primary/20 px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-ink-muted uppercase">Nightly Rate</span>
              <span className="font-black text-primary text-sm tabular-nums">Rs. {selectedRoom?.nightlyRate?.toLocaleString()} / night</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Guest Name</label>
              <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Full name" required
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Phone Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" required
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">ID Proof Document</label>
              <input type="text" value={idProof} onChange={(e) => setIdProof(e.target.value)} placeholder="Passport / Citizenship No." required
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Number of Guests</label>
              <input type="number" min="1" value={numGuests} onChange={(e) => setNumGuests(parseInt(e.target.value) || 1)} required
                className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">Expected Check-out Date</label>
            <input type="datetime-local" value={expectedCheckOut} onChange={(e) => setExpectedCheckOut(e.target.value)} required
              className="w-full rounded-control border border-border px-3 py-2 text-xs text-ink outline-none focus:border-primary" />
          </div>

          {checkInError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-3 text-xs text-danger">{checkInError}</div>
          )}
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL 2: SERVICE CHARGE TO ROOM
      ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={chargeOpen}
        onClose={() => { setChargeOpen(false); setSelectedRoom(null); setChargeError(null); }}
        title={`Add Service Charge — ${selectedRoom?.name || ""}`}
        className="max-w-2xl"
        footer={
          <button
            onClick={() => setChargeOpen(false)}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover transition-colors"
          >
            Done & Close
          </button>
        }
      >
        <div className="space-y-5">
          <div className="flex gap-4">
            {/* Category rail */}
            <div className="w-1/3 border-r border-border pr-3 space-y-1 overflow-y-auto max-h-[300px]">
              <button
                onClick={() => setSelectedCatId("ALL")}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-control text-xs font-bold transition-colors select-none",
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
                    "w-full text-left px-3 py-2 rounded-control text-xs font-bold transition-colors select-none",
                    selectedCatId === cat.id ? "bg-primary text-white" : "bg-transparent text-ink-muted hover:bg-surface-sunken"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu item grid */}
            <div className="flex-1 space-y-3">
              {/* Qty stepper */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-ink-muted uppercase">Quantity:</span>
                <div className="flex items-center gap-1.5 bg-surface-sunken border border-border rounded-control px-1">
                  <button onClick={() => setChargeQty(Math.max(1, chargeQty - 1))}
                    className="h-6 w-6 flex items-center justify-center text-ink hover:text-primary transition-colors">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-xs font-black text-ink w-5 text-center tabular-nums">{chargeQty}</span>
                  <button onClick={() => setChargeQty(chargeQty + 1)}
                    className="h-6 w-6 flex items-center justify-center text-ink hover:text-primary transition-colors">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                {filteredMenuItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handlePostCharge(item.id)}
                    className="rounded-control border border-border p-2.5 bg-card hover:bg-primary/5 hover:border-primary/40 cursor-pointer flex flex-col justify-between h-[72px] transition-all relative select-none group/item"
                  >
                    <h5 className="font-bold text-ink text-[11px] line-clamp-2 leading-tight group-hover/item:text-primary transition-colors">{item.name}</h5>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-primary font-black font-mono tabular-nums">Rs. {parseFloat(item.price).toFixed(0)}</span>
                      {chargeMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {chargeError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2 text-xs text-danger">{chargeError}</div>
          )}

          {/* Charged items summary */}
          {selectedRoom?.activeStay && (
            <div className="border-t border-border pt-4 space-y-2">
              <h4 className="text-[10px] font-black text-ink-muted uppercase tracking-wider">Charged Room Service</h4>
              <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                {selectedRoom.activeStay.orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs text-ink-muted font-mono">
                    <span>{item.name} × {item.qty}</span>
                    <span className="font-bold text-ink">Rs. {item.total.toFixed(0)}</span>
                  </div>
                ))}
                {selectedRoom.activeStay.orderItems.length === 0 && (
                  <p className="text-xs text-ink-muted italic">No items currently charged to this room.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          MODAL 3: CHECK OUT
      ══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={checkOutOpen}
        onClose={() => { setCheckOutOpen(false); setSelectedRoom(null); setCheckOutError(null); }}
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
              className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-xs font-bold rounded-control shadow-sm hover:bg-danger/90 disabled:opacity-50 transition-colors"
            >
              {checkOutMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Settle & Checkout</span>
            </button>
          </>
        }
      >
        {selectedRoom?.activeStay && (
          <form id="checkout-form" onSubmit={handleCheckOutSubmit} className="space-y-5">
            {/* Bill summary card */}
            <div className="rounded-card border border-border bg-surface-sunken p-4 space-y-3">
              <h4 className="text-[10px] font-black text-ink-muted uppercase tracking-wider">Stay Billing Summary</h4>
              <div className="space-y-2 text-xs font-mono text-ink-muted">
                <div className="flex justify-between">
                  <span>Guest:</span>
                  <span className="font-sans font-extrabold text-ink">{selectedRoom.activeStay.guestName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span className="text-ink">{selectedRoom.activeStay.numNights} Night{selectedRoom.activeStay.numNights > 1 ? "s" : ""}</span>
                </div>
                {selectedRoom.nightlyRate !== null && (
                  <div className="flex justify-between border-t border-border/40 pt-2">
                    <span>Lodging Charges:</span>
                    <span className="text-ink">Rs. {(selectedRoom.nightlyRate * selectedRoom.activeStay.numNights).toFixed(0)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Food & Service:</span>
                  <span className="text-ink">
                    Rs. {selectedRoom.activeStay.orderItems.reduce((s, i) => s + i.total, 0).toFixed(0)}
                  </span>
                </div>
                {selectedRoom.activeStay.stayTotal !== null && (
                  <div className="flex justify-between text-sm font-black text-ink border-t border-border/60 pt-2">
                    <span>Total Bill:</span>
                    <span className="text-primary tabular-nums">Rs. {selectedRoom.activeStay.stayTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-[10px] font-black text-ink-muted uppercase mb-2">Settlement Method</label>
              <div className="grid grid-cols-3 gap-2">
                {(["CASH", "CARD", "CREDIT"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    className={cn(
                      "py-2.5 rounded-control text-xs font-black border transition-all text-center select-none",
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
              <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">{checkOutError}</div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
