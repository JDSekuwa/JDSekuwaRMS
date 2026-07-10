import { requireRole } from "@/services/auth.service";
import { openTableOrder } from "@/services/sales.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const openSchema = z.object({
  tag: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tableId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]); // All logged-in roles can open table orders

    const body = await request.json().catch(() => ({}));
    const result = openSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { tag } = result.data;
    const order = await openTableOrder(tableId, tag || null, profile.id);

    return NextResponse.json(order);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
