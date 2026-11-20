import { requireRole } from "@/services/auth.service";
import { deleteExpenseCategory } from "@/services/expense.service";
import { Role } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  _request: NextRequest,
  context: RouteParams
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await context.params;

    const result = await deleteExpenseCategory(id, profile.id);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || (error.message?.includes("cannot be deleted") ? 400 : 500);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
