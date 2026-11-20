import { requireRole } from "@/services/auth.service";
import { getExpenseById, updateExpense, deleteExpense } from "@/services/expense.service";
import { Role, PaymentType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateExpenseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  date: z.string().optional(),
  paymentType: z.nativeEnum(PaymentType).optional(),
  vendor: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const expense = await getExpenseById(id, profile.id);
    return NextResponse.json(expense);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const body = await request.json();
    const parseResult = updateExpenseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }

    const updated = await updateExpense(id, parseResult.data, profile.id);
    return NextResponse.json(updated);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const deleted = await deleteExpense(id, profile.id);
    return NextResponse.json({ success: true, deleted });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
