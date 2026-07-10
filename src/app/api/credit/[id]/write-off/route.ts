import { requireRole } from "@/services/auth.service";
import { writeOff } from "@/services/credit.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: creditLedgerId } = await params;
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const updated = await writeOff(creditLedgerId, profile.id);
    return NextResponse.json(updated);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
