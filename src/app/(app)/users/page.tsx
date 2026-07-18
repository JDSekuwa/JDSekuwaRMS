"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal-sheet";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Plus,
  Key,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckCircle,
  RefreshCw,
  Mail,
  Shield,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "WORKER";
  createdAt: string;
  name: string;
  imageUrl?: string | null;
}

function UserAvatar({ name, imageUrl, className }: { name: string; imageUrl?: string | null; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "S";
  const colors = [
    "bg-red-500 text-white",
    "bg-blue-500 text-white",
    "bg-green-500 text-white",
    "bg-yellow-500 text-ink",
    "bg-purple-500 text-white",
    "bg-pink-500 text-white",
    "bg-indigo-500 text-white",
    "bg-teal-500 text-white"
  ];
  const charCodeSum = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const colorClass = colors[charCodeSum % colors.length];

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={cn("rounded-full object-cover border border-border shadow-xs", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-extrabold select-none shadow-xs border border-border/25",
        colorClass,
        className
      )}
    >
      {initial}
    </div>
  );
}

export default function UsersPage() {
  const { user: currentUser, role: currentUserRole, loading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  // Modals Visibility
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Selected Row tracking
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Forms Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [roleSelection, setRoleSelection] = useState<"SUPER_ADMIN" | "ADMIN" | "WORKER">("WORKER");
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  // Error/Success operational banners
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rowUpdatingId, setRowUpdatingId] = useState<string | null>(null);

  const handleImageUpload = async (file: File, mode: "new" | "edit") => {
    setUploading(true);
    setApiError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      if (mode === "new") {
        setImageUrl(data.url);
      } else {
        setEditImageUrl(data.url);
      }
    } catch (err: any) {
      setApiError(err.message || "Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  /* ── 1. QUERY STAFF MEMBERS ─────────────────────────────────────── */

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: paginatedData, isLoading: isUsersLoading, refetch } = useQuery<{ data: UserProfile[]; pagination: any }>({
    queryKey: ["users", page, limit, searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/users?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to load staff list.");
      return res.json();
    },
    enabled: currentUserRole === "SUPER_ADMIN",
    placeholderData: keepPreviousData,
  });
  const users = paginatedData?.data || [];
  const pagination = paginatedData?.pagination;

  /* ── 2. MUTATIONS ───────────────────────────────────────────────── */

  // Create User
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create user account.");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCreateOpen(false);
      setEmail("");
      setPassword("");
      setName("");
      setImageUrl("");
      setRoleSelection("WORKER");
      setApiError(null);
      setSuccessMsg(`Account '${data.email}' has been successfully provisioned.`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  // Update User Details (Name / Image)
  const updateDetailsMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { name: string; imageUrl?: string | null } }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update profile.");
      }
      return res.json();
    },
    onSuccess: () => {
      setEditOpen(false);
      setEditName("");
      setEditImageUrl("");
      setApiError(null);
      setSuccessMsg("Staff profile updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  // Update User Role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      setRowUpdatingId(id);
      const res = await fetch(`/api/users/${id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update role.");
      }
      return res.json();
    },
    onSuccess: () => {
      setApiError(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      setApiError(err.message);
      setTimeout(() => setApiError(null), 6000);
    },
    onSettled: () => {
      setRowUpdatingId(null);
    }
  });

  // Reset Password
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to reset password.");
      }
      return res.json();
    },
    onSuccess: () => {
      setResetOpen(false);
      setResetPasswordVal("");
      setApiError(null);
      setSuccessMsg(`Credentials override completed successfully for ${selectedUser?.email}.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  // Delete User Account
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete user account.");
      }
      return res.json();
    },
    onSuccess: () => {
      setDeleteOpen(false);
      setApiError(null);
      setSuccessMsg("The staff account has been deleted.");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setApiError(err.message);
    }
  });

  /* ── 3. ACCESS CONTROL GATING ───────────────────────────────────── */

  if (isAuthLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (currentUserRole !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-fade-in-up">
        <div className="h-14 w-14 rounded-full bg-danger/10 text-danger flex items-center justify-center shadow-xs">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="font-extrabold text-lg text-ink">Access Restricted</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Only users with the <span className="font-black text-danger">Super Admin</span> system role are permitted to view or manage credential directories.
          </p>
        </div>
      </div>
    );
  }

  /* ── 4. TABLE COLUMNS STRUCTURE ─────────────────────────────────── */

  const columns = [
    {
      key: "avatar",
      label: "Avatar",
      render: (_: any, row: UserProfile) => (
        <UserAvatar name={row.name} imageUrl={row.imageUrl} className="h-8.5 w-8.5" />
      )
    },
    {
      key: "name",
      label: "Staff Member",
      render: (_: any, row: UserProfile) => (
        <div>
          <div className="font-extrabold text-ink text-sm flex items-center gap-1.5">
            <span>{row.name}</span>
            {currentUser?.id === row.id && (
              <span className="text-[9px] bg-primary/10 text-primary font-black px-1.5 py-0.5 rounded-full select-none">
                You
              </span>
            )}
          </div>
          <div className="text-[10px] text-ink-muted/80 flex items-center gap-1 mt-0.5">
            <Mail className="h-3 w-3 shrink-0" />
            <span>{row.email}</span>
          </div>
        </div>
      )
    },
    {
      key: "role",
      label: "System Role Permissions",
      render: (val: string, row: UserProfile) => {
        const isSelf = currentUser?.id === row.id;
        const isUpdating = rowUpdatingId === row.id;

        return (
          <div className="flex items-center gap-2 select-none">
            {isSelf ? (
              <StatusBadge status={val} className="text-[9px] font-black" />
            ) : (
              <div className="relative flex items-center">
                <select
                  disabled={isUpdating}
                  value={val}
                  onChange={(e) => {
                    updateRoleMutation.mutate({ id: row.id, role: e.target.value });
                  }}
                  className={cn(
                    "rounded-control border font-extrabold px-2.5 py-1 text-[10px] uppercase tracking-wider outline-none disabled:opacity-50 select-none cursor-pointer shadow-xs transition-all",
                    val === "SUPER_ADMIN" ? "bg-danger/10 text-danger border-danger/25 hover:bg-danger/20" :
                    val === "ADMIN" ? "bg-warning/10 text-warning border-warning/25 hover:bg-warning/20" :
                    "bg-info/10 text-info border-info/25 hover:bg-info/20"
                  )}
                >
                  <option value="SUPER_ADMIN" className="bg-white text-ink dark:bg-card">Super Admin</option>
                  <option value="ADMIN" className="bg-white text-ink dark:bg-card">Admin</option>
                  <option value="WORKER" className="bg-white text-ink dark:bg-card">Worker</option>
                </select>
                {isUpdating && <Loader2 className="absolute -right-5 h-3.5 w-3.5 animate-spin text-primary" />}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: "createdAt",
      label: "Date Created",
      render: (val: string) => (
        <div className="flex items-center gap-1.5 text-ink-muted font-medium">
          <Clock className="h-3.5 w-3.5 text-ink-muted/60" />
          <span>{new Date(val).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
        </div>
      )
    },
    {
      key: "actions",
      label: "Administrative Actions",
      render: (_: any, row: UserProfile) => {
        const isSelf = currentUser?.id === row.id;

        return (
          <div className="flex items-center gap-2 select-none">
            <button
              onClick={() => {
                setSelectedUser(row);
                setEditName(row.name);
                setEditImageUrl(row.imageUrl || "");
                setEditOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-extrabold text-info bg-info/10 hover:bg-info/20 border border-info/20 hover:border-info/40 rounded-control transition-all cursor-pointer shadow-xs"
              title="Edit Profile"
            >
              <Shield className="h-3 w-3" />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => {
                setSelectedUser(row);
                setResetOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-extrabold text-warning bg-warning/10 hover:bg-warning/20 border border-warning/20 hover:border-warning/40 rounded-control transition-all cursor-pointer shadow-xs"
              title="Override Password"
            >
              <Key className="h-3 w-3" />
              <span>Reset Credentials</span>
            </button>

            {!isSelf && (
              <button
                onClick={() => {
                  setSelectedUser(row);
                  setDeleteOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-extrabold text-danger bg-danger/10 hover:bg-danger/20 border border-danger/20 hover:border-danger/40 rounded-control transition-all cursor-pointer shadow-xs"
                title="Delete Account"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <PageHeader
        title="Staff & User Accounts"
        description="Provision employee credentials, elevate role access settings, override login passwords, and audit account access."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-sunken hover:bg-border border border-border text-ink hover:text-primary text-xs font-semibold rounded-control transition-all duration-200 select-none shadow-xs active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync Lists</span>
            </button>

            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover transition-all duration-200 select-none shadow-xs active:scale-[0.98] animate-pulse-glow"
            >
              <Plus className="h-4 w-4" />
              <span>Provision Staff</span>
            </button>
          </div>
        }
      />

      {/* FEEDBACK STATUS BANNERS */}
      {successMsg && (
        <div className="rounded-control border border-success/30 bg-success/10 p-4 text-xs text-success flex items-center gap-2.5 animate-fade-in-up">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {apiError && (
        <div className="rounded-control border border-danger/30 bg-danger/10 p-4 text-xs text-danger flex items-center gap-2.5 animate-fade-in-up">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* SEARCH AND LIMIT FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-card border border-border bg-card shadow-xs">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search staff members by name or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-control border border-border bg-surface-sunken/45 pl-3 pr-4 py-1.5 text-xs text-ink placeholder-ink-muted/65 outline-none focus:border-primary focus:bg-card transition-all"
          />
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto select-none">
          <span className="text-xs text-ink-muted">Show:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="rounded-control border border-border bg-card text-ink font-semibold px-2.5 py-1 text-xs outline-none focus:border-primary shadow-xs cursor-pointer"
          >
            <option value={10}>10 accounts</option>
            <option value={15}>15 accounts</option>
            <option value={25}>25 accounts</option>
          </select>
        </div>
      </div>

      {/* STAFF LIST TABLE */}
      {isUsersLoading ? (
        <div className="flex h-[35vh] items-center justify-center text-primary">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in-up [animation-delay:100ms]">
          <div className="bg-card border border-border rounded-card p-1.5 shadow-sm overflow-hidden">
            <DataTable columns={columns} data={users} />
          </div>
          {pagination && (
            <PaginationControls
              currentPage={page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              limit={limit}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </div>
      )}

      {/* MODAL 1: CREATE STAFF ACCOUNT */}
      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEmail("");
          setPassword("");
          setName("");
          setImageUrl("");
          setRoleSelection("WORKER");
          setApiError(null);
        }}
        title="Provision New Staff Account"
        footer={
          <>
            <button
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!email || !password || !name) {
                  setApiError("Display Name, Email and password fields are required.");
                  return;
                }
                createMutation.mutate({ email, password, role: roleSelection, name, imageUrl: imageUrl || null });
              }}
              disabled={createMutation.isPending || uploading}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Create Credentials</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {apiError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {apiError}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Staff Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rabin Shrestha"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary bg-card"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@jdsekuwahouse.com"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Initial Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Profile Avatar (Optional)
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "new");
                }}
                className="w-full text-xs text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:text-[11px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
              />
              {uploading && (
                <div className="flex items-center gap-1.5 text-[10px] text-primary font-semibold">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Uploading profile image...</span>
                </div>
              )}
              {imageUrl && (
                <div className="relative h-16 w-16 rounded-full overflow-hidden border border-border mt-1">
                  <img src={imageUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              System Permissions Role
            </label>
            <select
              value={roleSelection}
              onChange={(e: any) => setRoleSelection(e.target.value)}
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none bg-card focus:border-primary"
            >
              <option value="WORKER">Worker (Waiters/Floor staff)</option>
              <option value="ADMIN">Admin (Cashiers/Store Manager)</option>
              <option value="SUPER_ADMIN">Super Admin (System Owner)</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: RESET PASSWORD */}
      <Modal
        isOpen={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setResetPasswordVal("");
          setApiError(null);
          setSelectedUser(null);
        }}
        title={`Reset Credentials — ${selectedUser?.email}`}
        footer={
          <>
            <button
              onClick={() => setResetOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedUser && resetPasswordVal) {
                  resetPasswordMutation.mutate({ id: selectedUser.id, password: resetPasswordVal });
                }
              }}
              disabled={!resetPasswordVal || resetPasswordMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {resetPasswordMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Override Password</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-control bg-surface-sunken border border-border p-3 text-xs text-ink-muted flex items-start gap-2">
            <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              You are overriding the password credentials for <span className="font-extrabold text-ink">{selectedUser?.email}</span>. The user will be required to log in with this new password on their next session.
            </span>
          </div>

          {apiError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {apiError}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              New Password
            </label>
            <input
              type="password"
              value={resetPasswordVal}
              onChange={(e) => setResetPasswordVal(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 3: DELETE STAFF ACCOUNT */}
      <Modal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setApiError(null);
          setSelectedUser(null);
        }}
        title="Confirm Account Deletion"
        footer={
          <>
            <button
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedUser) {
                  deleteMutation.mutate(selectedUser.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-xs font-bold rounded-control shadow-sm hover:bg-danger-hover disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Delete Permanently</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-control bg-danger/10 border border-danger/25 p-3.5 text-xs text-danger flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-danger" />
            <div className="space-y-1">
              <span className="font-extrabold block">High Risk Action</span>
              <p className="text-[11px] leading-relaxed">
                Are you absolutely sure you want to permanently delete <span className="font-black underline">{selectedUser?.email}</span>? 
                This will delete their user credentials from Supabase Auth and remove their staff database profile. This operation is **permanent and cannot be undone**.
              </p>
            </div>
          </div>

          {apiError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {apiError}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 4: EDIT STAFF DETAILS */}
      <Modal
        isOpen={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditName("");
          setEditImageUrl("");
          setApiError(null);
          setSelectedUser(null);
        }}
        title={`Edit Staff Profile — ${selectedUser?.email}`}
        footer={
          <>
            <button
              onClick={() => setEditOpen(false)}
              className="px-4 py-2 bg-transparent hover:bg-border text-ink-muted text-xs font-semibold rounded-control transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedUser && editName) {
                  updateDetailsMutation.mutate({
                    id: selectedUser.id,
                    payload: { name: editName, imageUrl: editImageUrl || null }
                  });
                }
              }}
              disabled={!editName || updateDetailsMutation.isPending || uploading}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-control shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {updateDetailsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {apiError && (
            <div className="rounded-control border border-danger/25 bg-danger/10 p-2.5 text-xs text-danger">
              {apiError}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Staff Display Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="e.g. Rabin Shrestha"
              className="w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-primary bg-card"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-ink-muted uppercase mb-1">
              Profile Avatar (Optional)
            </label>
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "edit");
                }}
                className="w-full text-xs text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:text-[11px] file:font-black file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
              />
              {uploading && (
                <div className="flex items-center gap-1.5 text-[10px] text-primary font-semibold">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Uploading profile image...</span>
                </div>
              )}
              {editImageUrl && (
                <div className="relative h-16 w-16 rounded-full overflow-hidden border border-border mt-1">
                  <img src={editImageUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setEditImageUrl("")}
                    className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
