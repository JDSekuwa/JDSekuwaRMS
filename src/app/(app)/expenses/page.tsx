"use client";

import React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ExpensesManagement } from "@/components/reports/expenses-management";

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Expenses"
        description="Record, categorize, and track operational overhead costs and vendor bills."
      />
      <ExpensesManagement />
    </div>
  );
}
