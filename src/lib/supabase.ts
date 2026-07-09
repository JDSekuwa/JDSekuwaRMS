import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route Handlers.
 * Fully supports asynchronous next/headers cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Can be ignored if called from a Server Component where cookies cannot be mutated
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set(name, "", options);
          } catch {
            // Can be ignored if called from a Server Component where cookies cannot be mutated
          }
        },
      },
    }
  );
}

/**
 * Creates an admin-level Supabase client using the service role key.
 * This bypasses RLS on auth tables and should only be used in seed scripts or administrative backend hooks.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
