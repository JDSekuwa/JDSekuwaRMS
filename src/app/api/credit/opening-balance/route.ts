import { requireRole } from "@/services/auth.service";
import { createOpeningBalanceEntry } from "@/services/credit.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { serverCache } from "@/lib/cache";

export async function POST(request: Request) {
  try {
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const body = await request.json();
    const { customerName, phone, amount, givenDate, dueDate } = body;

    if (!customerName || !phone || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Customer name, phone number, and opening debt amount are required." },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Opening debt amount must be a positive number." },
        { status: 400 }
      );
    }

    const result = await createOpeningBalanceEntry(
      customerName,
      phone,
      numAmount,
      givenDate,
      dueDate,
      profile.id
    );

    // Invalidate dashboard and credit caches
    serverCache.invalidate("dashboard");

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to create legacy customer opening balance." },
      { status }
    );
  }
}
