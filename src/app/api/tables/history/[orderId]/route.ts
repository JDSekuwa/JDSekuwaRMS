import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { getTableOrderHistoryDetail } from "@/services/tables.service";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const { orderId } = await params;
    const detail = await getTableOrderHistoryDetail(orderId);

    if (!detail) {
      return NextResponse.json(
        { error: "Table order visit not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
