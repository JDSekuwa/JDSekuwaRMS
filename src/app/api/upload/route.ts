import { requireRole } from "@/services/auth.service";
import { Role } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";

/**
 * POST /api/upload: Receive image upload and save to Supabase Storage.
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

    const supabase = createAdminClient();
    const bucketName = "uploads";

    // 1. Ensure the bucket exists by checking/creating it
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      throw new Error(`Failed to list storage buckets: ${listError.message}`);
    }

    const bucketExists = buckets.some((b) => b.id === bucketName);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
      });
      if (createError) {
        throw new Error(`Failed to create storage bucket: ${createError.message}`);
      }
    }

    // 2. Generate a unique name
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${Date.now()}-${cleanName}`;

    // 3. Upload buffer to Supabase Storage uploads bucket
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filename, buffer, {
        contentType: fileType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // 4. Retrieve public URL
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(filename);
    const fileUrl = urlData.publicUrl;

    return NextResponse.json({ url: fileUrl });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status }
    );
  }
}
