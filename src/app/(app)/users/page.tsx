"use client";

import React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus } from "lucide-react";

export default function UsersPlaceholder() {
  const mockUsers = [
    { id: 1, email: "superadmin@example.com", role: "SUPER_ADMIN", created: "2026-07-09", status: "SUCCESS" },
    { id: 2, email: "admin1@example.com", role: "ADMIN", created: "2026-07-09", status: "SUCCESS" },
    { id: 3, email: "worker1@example.com", role: "WORKER", created: "2026-07-09", status: "SUCCESS" },
    { id: 4, email: "worker2@example.com", role: "WORKER", created: "2026-07-09", status: "SUCCESS" },
  ];

  const columns = [
    { key: "email", label: "Email Address", sortable: true },
    {
      key: "role",
      label: "System Role",
      render: (val: string) => (
        <StatusBadge status={val} />
      )
    },
    { key: "created", label: "Date Added" },
    {
      key: "status",
      label: "Profile Status",
      render: (val: string) => (
        <StatusBadge status={val === "SUCCESS" ? "ACTIVE" : "INACTIVE"} />
      )
    },
    {
      key: "actions",
      label: "Actions",
      render: () => (
        <button className="text-xs text-primary font-bold hover:underline">
          Reset Password
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & User Accounts"
        description="Add, edit, and audit operational access credentials."
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-control shadow-sm hover:bg-primary-hover transition-colors">
            <Plus className="h-4 w-4" />
            <span>Create User</span>
          </button>
        }
      />

      <div className="space-y-3">
        <DataTable columns={columns} data={mockUsers} />
      </div>
    </div>
  );
}
