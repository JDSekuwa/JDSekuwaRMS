import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * POST /api/upload: Receive image upload and save to local public/uploads directory.
 * Restricted to ADMIN and SUPER_ADMIN.
 */
export async function POST(request: Request) {
  try {
    // Only administrators are allowed to upload store resources
    await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

    const data = await request.formData();
    const file: File | null = data.get("file") as unknown as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Verify it is an image file
    const fileType = file.type;
    if (!fileType.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure public/uploads directory exists on disk
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique name
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${Date.now()}-${cleanName}`;
    const filePath = path.join(uploadDir, filename);

    // Write file to filesystem
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status }
    );
  }
}
