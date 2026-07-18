import { prisma, superuserPrisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { createAdminClient } from "../lib/supabase";
import { logAction } from "./audit.service";
import { ForbiddenError } from "../lib/errors";
import { getCachedProfile } from "./auth.service";
import { serverCache } from "../lib/cache";

/**
 * Assures caller is a SUPER_ADMIN profile.
 */
async function requireSuperAdmin(callerUserId: string) {
  const profile = await getCachedProfile(callerUserId);
  if (!profile || profile.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenError("Only Super Admins can manage staff profiles.");
  }
  return profile;
}

/**
 * Returns joined PostgreSQL profiles with Supabase Auth emails and metadata.
 */
export async function listStaffUsers(
  callerUserId: string,
  options?: { skip?: number; take?: number; search?: string }
): Promise<any[] | { data: any[]; total: number }> {
  await requireSuperAdmin(callerUserId);
  const supabase = createAdminClient();

  // 1. Fetch Postgres profile directory
  const dbProfiles = await superuserPrisma.profile.findMany({
    orderBy: { createdAt: "desc" }
  });

  // 2. Fetch auth user directory from Supabase Auth admin API
  const { data: { users = [] }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    throw new Error(`Failed to list Supabase Auth users: ${error.message}`);
  }

  // 3. Join the data on user ID (UUID)
  let mapped = dbProfiles.map(profile => {
    const authUser = users.find(u => u.id === profile.id);
    return {
      id: profile.id,
      email: authUser?.email || "unknown@example.com",
      role: profile.role,
      name: authUser?.user_metadata?.name || authUser?.email?.split("@")[0] || "Staff",
      imageUrl: authUser?.user_metadata?.imageUrl || null,
      createdAt: authUser?.created_at || profile.createdAt.toISOString()
    };
  });

  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    mapped = mapped.filter(
      (m) =>
        m.name.toLowerCase().includes(searchLower) ||
        m.email.toLowerCase().includes(searchLower)
    );
  }

  if (options?.skip !== undefined && options?.take !== undefined) {
    const total = mapped.length;
    const paginatedResult = mapped.slice(options.skip, options.skip + options.take);
    return { data: paginatedResult, total };
  }

  return mapped;
}

/**
 * Creates user in Supabase Auth and inserts matching profile in PostgreSQL.
 */
export async function createStaffUser(
  callerUserId: string,
  email: string,
  password: string,
  role: Role,
  name?: string,
  imageUrl?: string | null
): Promise<any> {
  await requireSuperAdmin(callerUserId);
  const supabase = createAdminClient();

  const finalName = name || email.split("@")[0] || "Staff";
  const finalImageUrl = imageUrl || null;

  // 1. Create Supabase Auth credentials using the Admin API
  const { data: { user }, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { role, name: finalName, imageUrl: finalImageUrl }
  });

  if (error || !user) {
    throw new Error(`Failed to create auth credentials: ${error?.message || "Unknown error"}`);
  }

  // 2. Insert matching postgres profile row and log action
  try {
    const profile = await superuserPrisma.profile.create({
      data: {
        id: user.id,
        role
      }
    });

    await logAction(
      callerUserId,
      "CREATE_STAFF_USER",
      "Profile",
      profile.id,
      { email, role, name: finalName, imageUrl: finalImageUrl }
    );

    return {
      id: profile.id,
      email,
      role: profile.role,
      name: finalName,
      imageUrl: finalImageUrl,
      createdAt: user.created_at
    };
  } catch (dbErr: any) {
    // Attempt rollback of the Supabase auth user if database profile insert fails
    await supabase.auth.admin.deleteUser(user.id);
    throw new Error(`Failed to initialize Postgres profile: ${dbErr.message}`);
  }
}

/**
 * Updates staff user role in both Auth metadata and PostgreSQL.
 */
export async function updateStaffUserRole(
  callerUserId: string,
  targetUserId: string,
  newRole: Role
): Promise<any> {
  await requireSuperAdmin(callerUserId);
  const supabase = createAdminClient();

  if (callerUserId === targetUserId) {
    throw new Error("Self-role modifications are restricted to prevent lockouts.");
  }

  // 1. Update app metadata role in Supabase Auth
  const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
    app_metadata: { role: newRole },
    user_metadata: { role: newRole }
  });
  if (error) {
    throw new Error(`Failed to update auth metadata: ${error.message}`);
  }

  // 2. Update PostgreSQL database profile
  const profile = await superuserPrisma.profile.update({
    where: { id: targetUserId },
    data: { role: newRole }
  });

  serverCache.invalidate(`profile:${targetUserId}`);

  await logAction(
    callerUserId,
    "UPDATE_STAFF_USER_ROLE",
    "Profile",
    targetUserId,
    { newRole }
  );

  return profile;
}

/**
 * Administrative override to reset a staff user's password.
 */
export async function resetStaffUserPassword(
  callerUserId: string,
  targetUserId: string,
  password: string
): Promise<any> {
  await requireSuperAdmin(callerUserId);
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
    password
  });
  if (error) {
    throw new Error(`Failed to reset auth password: ${error.message}`);
  }

  await logAction(
    callerUserId,
    "RESET_STAFF_USER_PASSWORD",
    "Profile",
    targetUserId,
    {}
  );

  return { success: true };
}

/**
 * Deletes user from both Supabase Auth and PostgreSQL.
 */
export async function deleteStaffUser(
  callerUserId: string,
  targetUserId: string
): Promise<any> {
  await requireSuperAdmin(callerUserId);
  const supabase = createAdminClient();

  if (callerUserId === targetUserId) {
    throw new Error("Self-deletions are restricted.");
  }

  // 1. Delete user from Supabase Auth
  const { error } = await supabase.auth.admin.deleteUser(targetUserId);
  if (error) {
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }

  // 2. Delete database Profile (Prisma schema will cascade deletes if configured, 
  // or restrict. Let's delete database profile).
  const profile = await superuserPrisma.profile.delete({
    where: { id: targetUserId }
  });

  serverCache.invalidate(`profile:${targetUserId}`);

  await logAction(
    callerUserId,
    "DELETE_STAFF_USER",
    "Profile",
    targetUserId,
    {}
  );

  return { success: true, id: profile.id };
}

/**
 * Updates a staff user's name and image in Supabase Auth user metadata.
 */
export async function updateStaffUser(
  callerUserId: string,
  targetUserId: string,
  name: string,
  imageUrl: string | null
): Promise<any> {
  await requireSuperAdmin(callerUserId);
  const supabase = createAdminClient();

  // 1. Update user_metadata in Supabase Auth
  const { data: { user }, error } = await supabase.auth.admin.updateUserById(targetUserId, {
    user_metadata: { name, imageUrl }
  });
  if (error || !user) {
    throw new Error(`Failed to update staff credentials: ${error?.message || "Unknown error"}`);
  }

  await logAction(
    callerUserId,
    "UPDATE_STAFF_USER",
    "Profile",
    targetUserId,
    { name, imageUrl }
  );

  return {
    id: targetUserId,
    name: user.user_metadata?.name || name,
    imageUrl: user.user_metadata?.imageUrl || imageUrl
  };
}
