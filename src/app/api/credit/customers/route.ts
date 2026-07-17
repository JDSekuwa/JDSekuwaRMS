import { requireRole } from "@/services/auth.service";
import { listCreditCustomers } from "@/services/credit.service";
import { getPaginationParams, paginateResults } from "@/lib/pagination";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const { skip, take, search, page, limit } = getPaginationParams(request);
    const result = await listCreditCustomers({ skip, take, search });

    if (result && typeof result === "object" && "data" in result) {
      return NextResponse.json(paginateResults(result.data, result.total, page, limit));
    }
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
