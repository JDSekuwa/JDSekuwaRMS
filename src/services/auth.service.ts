import { createClient } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { UnauthenticatedError, ForbiddenError } from "../lib/errors";
import { cookies } from "next/headers";
import { serverCache } from "../lib/cache";
import { User } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reads token cookies and returns cached Supabase user session for 15 seconds.
 * Fallback to secure API getUser() validation on cache miss.
 */
export async function getCachedUser(): Promise<User | null> {
  let tokenKey = "";
  try {
    const cookieStore = await cookies();
    const authCookies = cookieStore.getAll()
      .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
      .sort((a, b) => a.name.localeCompare(b.name));
    tokenKey = authCookies.map((c) => c.value).join("");
  } catch (err) {
    // cookies() might fail if not in request context (e.g. tests or scripts)
  }

  const userCacheKey = tokenKey ? `auth-user:${tokenKey}` : "";
  if (userCacheKey) {
    const cached = serverCache.get<User>(userCacheKey);
    if (cached) return cached;
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  if (userCacheKey) {
    serverCache.set(userCacheKey, user, 15); // Cache auth user session for 15 seconds
  }
  return user;
}

/**
 * Returns cached database Profile record for 30 seconds.
 */
export async function getCachedProfile(userId: string): Promise<Profile | null> {
  const profileCacheKey = `profile:${userId}`;
  let profile = serverCache.get<Profile>(profileCacheKey);
  if (!profile) {
    profile = await prisma.profile.findUnique({
      where: { id: userId },
    });
    if (profile) {
      serverCache.set(profileCacheKey, profile, 30); // Cache database Profile record for 30 seconds
    }
  }
  return profile;
}

/**
 * Resolves the current logged in Supabase user session and retrieves the matching database Profile.
 * In Next.js Middleware (Edge Runtime), it falls back to reading the role from app_metadata.role
 * to avoid making TCP connections to PostgreSQL which Edge runtimes don't support.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCachedUser();

  if (!user) {
    return null;
  }

  // Fallback to app_metadata if running in Next.js Middleware / Edge Runtime
  if (process.env.NEXT_RUNTIME === "edge") {
    const roleFromMetadata = user.app_metadata?.role as Role | undefined;
    return {
      id: user.id,
      role: roleFromMetadata || Role.WORKER,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at || user.created_at),
    };
  }

  return getCachedProfile(user.id);
}

/**
 * Asserts the current user has one of the allowed roles, throwing ForbiddenError/UnauthenticatedError if not.
 */
export async function requireRole(allowedRoles: Role[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new UnauthenticatedError();
  }

  if (!allowedRoles.includes(profile.role)) {
    throw new ForbiddenError();
  }

  return profile;
}

/**
 * Boolean check for if the current user has a specific role.
 */
export async function hasRole(allowedRoles: Role[] | Role): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile) return false;

  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return rolesArray.includes(profile.role);
}

/**
 * Sets PostgreSQL app.current_role and app.current_user_id local variables
 * inside the provided transaction/connection block.
 */
export async function setSessionContext(
  tx: any,
  role: Role | string,
  userId: string
): Promise<void> {
  // Use set_config to securely set the local variable parameters inside the connection session.
  // The third parameter (true) makes the config setting local to the current transaction.
  await tx.$executeRaw`SELECT set_config('app.current_role', ${role}, true);`;
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true);`;
}
