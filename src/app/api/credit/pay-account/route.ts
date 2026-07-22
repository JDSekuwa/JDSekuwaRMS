import { requireRole } from "@/services/auth.service";
import { recordCustomerAccountPayment } from "@/services/credit.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const body = await request.json();
    const { phone, amount } = body;

    if (!phone || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "Phone number and payment amount are required." },
        { status: 400 }
      );
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be a positive number." },
        { status: 400 }
      );
    }

    const result = await recordCustomerAccountPayment(phone, numAmount, profile.id);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to record customer account payment" },
      { status }
    );
  }
}
