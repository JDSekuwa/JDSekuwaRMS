import { requireRole } from "@/services/auth.service";
import { checkIn } from "@/services/rooms.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const checkInSchema = z.object({
  guestName: z.string().min(1, "Guest name is required"),
  phone: z.string().min(1, "Phone number is required"),
  idProof: z.string().min(1, "ID proof is required"),
  numGuests: z.number().int().positive(),
  expectedCheckOut: z.string().datetime(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = checkInSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const guestDetails = {
      ...result.data,
      expectedCheckOut: new Date(result.data.expectedCheckOut),
    };

    const roomStay = await checkIn(roomId, guestDetails, profile.id);
    return NextResponse.json(roomStay);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
