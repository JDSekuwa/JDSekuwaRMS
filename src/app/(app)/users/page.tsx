"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal-sheet";
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
}

export default function UsersPage() {
  const { user: currentUser, role: currentUserRole, loading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();

  // Modals Visibility
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Selected Row tracking
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Forms Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleSelection, setRoleSelection] = useState<"SUPER_ADMIN" | "ADMIN" | "WORKER">("WORKER");
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  // Error/Success operational banners
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rowUpdatingId, setRowUpdatingId] = useState<string | null>(null);

  /* ── 1. QUERY STAFF MEMBERS ─────────────────────────────────────── */

  const { data: users = [], isLoading: isUsersLoading, refetch } = useQuery<UserProfile[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to load user directory");
      return res.json();
    },
    enabled: currentUserRole === "SUPER_ADMIN"
  });

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
      key: "email",
      label: "Email Address",
      render: (val: string, row: UserProfile) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-ink-muted/50" />
          <span className="font-extrabold text-ink">{val}</span>
          {currentUser?.id === row.id && (
            <span className="text-[9px] bg-primary/10 text-primary font-black px-1.5 py-0.5 rounded-full select-none">
              You
            </span>
          )}
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
                  className="rounded-control border border-border bg-card text-ink font-semibold px-2 py-1 text-xs outline-none focus:border-primary disabled:opacity-50 select-none shadow-xs"
                >
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="WORKER">Worker</option>
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedUser(row);
                setResetOpen(true);
              }}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary-hover font-bold"
              title="Override Password"
            >
              <Key className="h-3.5 w-3.5" />
              <span>Reset Credentials</span>
            </button>

            {!isSelf && (
              <button
                onClick={() => {
                  setSelectedUser(row);
                  setDeleteOpen(true);
                }}
                className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-danger font-bold"
                title="Delete Account"
              >
                <Trash2 className="h-3.5 w-3.5" />
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

      {/* STAFF LIST TABLE */}
      {isUsersLoading ? (
        <div className="flex h-[35vh] items-center justify-center text-primary">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-card p-1.5 shadow-sm overflow-hidden animate-fade-in-up [animation-delay:100ms]">
          <DataTable columns={columns} data={users} />
        </div>
      )}

      {/* MODAL 1: CREATE STAFF ACCOUNT */}
      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setEmail("");
          setPassword("");
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
                if (!email || !password) {
                  setApiError("Email and password fields are required.");
                  return;
                }
                createMutation.mutate({ email, password, role: roleSelection });
              }}
              disabled={createMutation.isPending}
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
    </div>
  );
}
