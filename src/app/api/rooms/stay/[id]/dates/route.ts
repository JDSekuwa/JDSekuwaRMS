import { requireRole } from "@/services/auth.service";
import { updateRoomStayDates } from "@/services/rooms.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

const datesSchema = z.object({
  expectedCheckOut: z.string().datetime(),
  numNights: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomStayId } = await params;
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const result = datesSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const expectedCheckOut = new Date(result.data.expectedCheckOut);
    const data = await updateRoomStayDates(
      roomStayId,
      expectedCheckOut,
      result.data.numNights,
      profile.id
    );

    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
