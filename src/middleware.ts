import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set(name, value);
          response = NextResponse.next({ request });
          response.cookies.set(name, value, options);
        },
        remove(name: string, options: any) {
          request.cookies.set(name, "");
          response = NextResponse.next({ request });
          response.cookies.set(name, "", options);
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Define public paths that bypass auth checks
  const isPublicPath =
    path === "/login" ||
    path === "/forgot-password" ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/_next/") ||
    path === "/favicon.ico" ||
    path.startsWith("/static/") ||
    path.match(/\.(png|jpg|jpeg|gif|svg|ico)$/) !== null;

  if (!isPublicPath) {
    if (!user) {
      // Redirect unauthenticated user to login page
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }

    // --- Session Inactivity Check (10 Minutes) ---
    const lastActivityStr = request.cookies.get("rms_last_activity")?.value;
    const now = Date.now();
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

    if (!lastActivityStr || now - parseInt(lastActivityStr) > INACTIVITY_TIMEOUT) {
      // Session expired due to inactivity
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      url.searchParams.set("message", "Session expired due to inactivity.");

      const redirectResponse = NextResponse.redirect(url);

      // Clean up Supabase auth cookies and the inactivity cookie
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith("sb-") || cookie.name === "rms_last_activity") {
          redirectResponse.cookies.set(cookie.name, "", { maxAge: -1, path: "/" });
        }
      }

      return redirectResponse;
    }

    // Role-based pre-filtering (fast routing pre-filter)
    const role = user.app_metadata?.role as string | undefined;

    // Direct routing restrictions for WORKER role
    if (role === "WORKER") {
      // Workers should not access admin pages (e.g. settings, reports, auditing, inventory adjustments)
      const isRestrictedAdminPath =
        path.startsWith("/settings") ||
        path.startsWith("/reports") ||
        path.startsWith("/audit") ||
        (path.startsWith("/api/") && 
         (path.startsWith("/api/settings") || 
          path.startsWith("/api/reports") || 
          path.startsWith("/api/audit")));
      
      if (isRestrictedAdminPath) {
        // Return 403 Forbidden for API, redirect to /pos or /dashboard for pages
        if (path.startsWith("/api/")) {
          return new NextResponse(
            JSON.stringify({ error: "Forbidden: Worker access restricted" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = "/pos"; // Fallback page for workers
        return NextResponse.redirect(url);
      }
    }

    // Active session: extend/refresh the activity cookie
    response.cookies.set("rms_last_activity", now.toString(), {
      maxAge: 600, // 10 minutes in seconds
      path: "/",
      httpOnly: false, // Let client read/write it
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  // Run middleware on all paths except static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
