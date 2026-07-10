import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { superuserPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * GET /api/rooms: retrieves all rooms and includes active stays if occupied.
 * Accessible to WORKER, ADMIN, and SUPER_ADMIN.
 */
export async function GET() {
  try {
    const profile = await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    // Gated nightly rate if caller is a WORKER
    const isWorker = profile.role === Role.WORKER;

    const rooms = await superuserPrisma.room.findMany({
      include: {
        stays: {
          where: { status: "ACTIVE" },
          include: {
            orderItems: {
              where: { isVoid: false },
              include: { menuItem: true }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    });

    // Strip nightly rate and stay charges details if worker connection
    const mappedRooms = rooms.map((room) => {
      const activeStay = room.stays[0] || null;
      let stayTotal = null;

      if (activeStay) {
        const roomCharge = isWorker ? 0 : Number(room.nightlyRate) * activeStay.numNights;
        const foodCharges = activeStay.orderItems.reduce(
          (sum, item) => sum + Number(item.unitPrice) * item.qty,
          0
        );
        stayTotal = isWorker ? foodCharges : roomCharge + foodCharges;
      }

      return {
        id: room.id,
        name: room.name,
        status: room.status,
        nightlyRate: isWorker ? null : Number(room.nightlyRate),
        activeStay: activeStay
          ? {
              id: activeStay.id,
              guestName: activeStay.guestName,
              phone: activeStay.phone,
              idProof: activeStay.idProof,
              numGuests: activeStay.numGuests,
              checkIn: activeStay.checkIn,
              expectedCheckOut: activeStay.expectedCheckOut,
              numNights: activeStay.numNights,
              orderItems: activeStay.orderItems.map((item) => ({
                id: item.id,
                name: item.menuItem.name,
                qty: item.qty,
                unitPrice: Number(item.unitPrice),
                total: Number(item.unitPrice) * item.qty
              })),
              stayTotal
            }
          : null
      };
    });

    return NextResponse.json(mappedRooms);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
