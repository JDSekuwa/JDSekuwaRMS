import { requireRole } from "@/services/auth.service";
import { listExpenseCategories, createExpenseCategory } from "@/services/expense.service";
import { Role } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  description: z.string().max(300).optional().nullable(),
});

export async function GET() {
  try {
    await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const categories = await listExpenseCategories();
    return NextResponse.json(categories);
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

    const parseResult = createCategorySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }

    const { name, description } = parseResult.data;
    const category = await createExpenseCategory(name, description, profile.id);
    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
