import { getCurrentProfile } from "@/services/auth.service";
import { getInventoryList } from "@/services/inventory.service";
import { UnauthenticatedError } from "@/lib/errors";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      throw new UnauthenticatedError();
    }

    const items = await getInventoryList(profile.role);
    return NextResponse.json(items);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
