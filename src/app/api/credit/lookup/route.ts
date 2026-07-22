import { requireRole } from "@/services/auth.service";
import { getCustomerCreditLookup } from "@/services/credit.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    await requireRole([Role.WORKER, Role.ADMIN, Role.SUPER_ADMIN]);

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone") || searchParams.get("search") || "";

    const result = await getCustomerCreditLookup(phone);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
