import { requireRole } from "@/services/auth.service";
import { getSalesReport } from "@/services/reports.service";
import { Role } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const querySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
  })
  .refine(
    (data) => new Date(data.startDate) <= new Date(data.endDate),
    {
      message: "startDate cannot be after endDate",
      path: ["endDate"],
    }
  );

export async function GET(request: NextRequest) {
  try {
    const profile = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    // Default to last 30 days if parameters omitted
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const parseResult = querySchema.safeParse({
      startDate: startDateParam || thirtyDaysAgo.toISOString().split("T")[0],
      endDate: endDateParam || today.toISOString().split("T")[0],
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid date parameters" },
        { status: 400 }
      );
    }

    const { startDate, endDate } = parseResult.data;

    const report = await getSalesReport(
      {
        start: new Date(`${startDate}T00:00:00.000`),
        end: new Date(`${endDate}T23:59:59.999`),
      },
      profile.id
    );

    return NextResponse.json(report);
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status }
    );
  }
}
