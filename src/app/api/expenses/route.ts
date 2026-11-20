import { requireRole } from "@/services/auth.service";
import { createExpense, listExpenses } from "@/services/expense.service";
import { Role, PaymentType } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPaginationParams, paginateResults } from "@/lib/pagination";

const createExpenseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  categoryId: z.string().uuid("Invalid category ID format"),
  amount: z.number().positive("Amount must be greater than 0"),
  date: z.string().optional(),
  paymentType: z.nativeEnum(PaymentType).optional(),
  vendor: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const { skip, take, search, page, limit } = getPaginationParams(request);
    const { searchParams } = new URL(request.url);

    const categoryId = searchParams.get("categoryId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const result = await listExpenses(
      {
        startDate,
        endDate,
        categoryId,
        search,
        skip,
        take,
      },
      profile.id
    );

    const paginated = paginateResults(result.expenses, result.total, page, limit);

    return NextResponse.json({
      ...paginated,
      totalAmount: result.totalAmount,
    });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const parseResult = createExpenseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }

    const created = await createExpense(parseResult.data, profile.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
