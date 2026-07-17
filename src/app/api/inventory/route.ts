import { getCurrentProfile, requireRole } from "@/services/auth.service";
import { getInventoryList } from "@/services/inventory.service";
import { getPaginationParams, paginateResults } from "@/lib/pagination";
import { UnauthenticatedError } from "@/lib/errors";
import { Role, Unit } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { superuserPrisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new UnauthenticatedError();
    }

    const { skip, take, search, page, limit } = getPaginationParams(request);

    const { items, total } = await getInventoryList(profile.role, { skip, take, search });
    return NextResponse.json(paginateResults(items, total, page, limit));
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Gate to admin/superadmin
    await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const body = await request.json();
    const { name, unit, minThreshold, costPrice, currentStock = 0 } = body;

    if (!name || !unit || minThreshold === undefined || costPrice === undefined) {
      return NextResponse.json(
        { error: "Name, unit, minThreshold, and costPrice are required." },
        { status: 400 }
      );
    }

    if (!Object.values(Unit).includes(unit)) {
      return NextResponse.json(
        { error: `Invalid unit. Allowed values are: ${Object.values(Unit).join(", ")}` },
        { status: 400 }
      );
    }

    // Create raw item using superuserPrisma to bypass RLS policies for administrative inserts
    const newItem = await superuserPrisma.rawItem.create({
      data: {
        name,
        unit,
        minThreshold: Number(minThreshold),
        costPrice: Number(costPrice),
        currentStock: Number(currentStock)
      }
    });

    return NextResponse.json(newItem);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: `A raw item named "${name}" already exists. Please choose a different name.` },
        { status: 400 }
      );
    }
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to create raw item." },
      { status }
    );
  }
}
