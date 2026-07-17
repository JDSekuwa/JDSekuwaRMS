import { getCurrentProfile } from "@/services/auth.service";
import { getInventoryList } from "@/services/inventory.service";
import { getPaginationParams, paginateResults } from "@/lib/pagination";
import { UnauthenticatedError } from "@/lib/errors";
import { NextResponse } from "next/server";

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
