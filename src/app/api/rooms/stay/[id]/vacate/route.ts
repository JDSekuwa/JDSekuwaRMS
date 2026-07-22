import { requireRole } from "@/services/auth.service";
import { vacateRoomStay } from "@/services/rooms.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // Body is optional
    }

    const result = await vacateRoomStay(id, profile.id, reason);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to vacate room stay" },
      { status }
    );
  }
}
