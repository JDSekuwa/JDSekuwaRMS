import { requireRole } from "@/services/auth.service";
import { vacateTableOrder } from "@/services/sales.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const vacateSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tableId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json().catch(() => ({}));
    const result = vacateSchema.safeParse(body);

    const reason = result.success ? result.data.reason : undefined;

    const data = await vacateTableOrder(tableId, profile.id, reason);

    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
