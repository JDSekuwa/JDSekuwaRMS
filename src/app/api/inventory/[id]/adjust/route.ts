import { requireRole } from "@/services/auth.service";
import { adjustStock } from "@/services/inventory.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const adjustSchema = z.object({
  qtyDelta: z.number(),
  reason: z.string().min(1, "Reason is required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawItemId } = await params;
    
    // Adjusting stock is restricted to WORKER, ADMIN, or SUPER_ADMIN
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = adjustSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const { qtyDelta, reason } = result.data;

    const data = await adjustStock(rawItemId, qtyDelta, reason, profile.id);
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
