import { requireRole } from "@/services/auth.service";
import { getLastPurchaseForItem } from "@/services/inventory.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const lastPurchase = await getLastPurchaseForItem(id, profile.id);

    if (!lastPurchase) {
      return NextResponse.json({ notFound: true });
    }

    return NextResponse.json(lastPurchase);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to fetch last purchase details" },
      { status }
    );
  }
}
