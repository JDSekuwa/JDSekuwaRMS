import { createClient } from "../lib/supabase";
import { prisma } from "../lib/prisma";
import { Role } from "../generated/prisma/client";
import { UnauthenticatedError, ForbiddenError } from "../lib/errors";

export interface Profile {
  id: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolves the current logged in Supabase user session and retrieves the matching database Profile.
 * In Next.js Middleware (Edge Runtime), it falls back to reading the role from app_metadata.role
 * to avoid making TCP connections to PostgreSQL which Edge runtimes don't support.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
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

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  return profile;
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
