import { requireRole } from "@/services/auth.service";
import { updateRawItem, deleteRawItem } from "@/services/inventory.service";
import { Role, Unit } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverCache } from "@/lib/cache";

const updateRawItemSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  unit: z.enum(Object.values(Unit) as [string, ...string[]]).optional(),
  minThreshold: z.number().min(0, "Min threshold must be non-negative").optional(),
  costPrice: z.number().min(0, "Cost price must be non-negative").optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const body = await request.json();
    const result = updateRawItemSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateRawItem(id, result.data, profile.id);

    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A raw item with this name already exists." },
        { status: 400 }
      );
    }
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to update raw item" },
      { status }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
    const { id } = await params;

    const res = await deleteRawItem(id, profile.id);

    serverCache.invalidate("inventory");
    serverCache.invalidate("dashboard");

    return NextResponse.json(res);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Failed to delete raw item" },
      { status }
    );
  }
}
