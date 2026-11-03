import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { getTableOrderHistory } from "@/services/tables.service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get("tableId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const pageStr = searchParams.get("page");
    const limitStr = searchParams.get("limit");

    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    const history = await getTableOrderHistory({
      tableId,
      startDate,
      endDate,
      page: isNaN(page) ? 1 : page,
      limit: isNaN(limit) ? 20 : limit,
    });

    return NextResponse.json(history);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
