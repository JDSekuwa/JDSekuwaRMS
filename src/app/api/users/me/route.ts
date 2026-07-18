import { getCachedUser } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getCachedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split("@")[0] || "Staff",
      imageUrl: user.user_metadata?.imageUrl || null,
      role: user.app_metadata?.role || Role.WORKER
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch profile." },
      { status: 500 }
    );
  }
}
