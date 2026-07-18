import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function decodeJWT(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export async function middleware(request: NextRequest) {
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

  if (isPublicPath) {
    return NextResponse.next();
  }

  // --- 1. LOCAL AUTH COOKIE FAST-PATH ---
  const allCookies = request.cookies.getAll();
  const authCookies = allCookies
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));

  let localUser = null;
  let hasValidSession = false;

  if (authCookies.length > 0) {
    try {
      const rawValue = authCookies.map((c) => c.value).join("");
      const decodedValue = decodeURIComponent(rawValue);
      let session = null;
      try {
        session = JSON.parse(decodedValue);
      } catch (err) {
        session = JSON.parse(rawValue);
      }

      const accessToken = session?.access_token;
      if (accessToken) {
        const payload = decodeJWT(accessToken);
        const nowSeconds = Math.floor(Date.now() / 1000);
        // Ensure the token is valid for at least 60 more seconds
        if (payload && payload.exp && nowSeconds < payload.exp - 60) {
          hasValidSession = true;
          localUser = {
            id: payload.sub,
            app_metadata: payload.app_metadata || {},
            user_metadata: payload.user_metadata || {},
          };
        }
      }
    } catch (e) {
      // Failed to parse, fall back to slow path
    }
  }

  // If local validation succeeds, process request in under 1ms locally
  if (hasValidSession && localUser) {
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // --- Session Inactivity Check (10 Minutes) ---
    const lastActivityStr = request.cookies.get("rms_last_activity")?.value;
    const now = Date.now();
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

    if (!lastActivityStr || now - parseInt(lastActivityStr) > INACTIVITY_TIMEOUT) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      url.searchParams.set("message", "Session expired due to inactivity.");

      const redirectResponse = NextResponse.redirect(url);
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith("sb-") || cookie.name === "rms_last_activity") {
          redirectResponse.cookies.set(cookie.name, "", { maxAge: -1, path: "/" });
        }
      }
      return redirectResponse;
    }

    // Role-based path validation
    const role = localUser.app_metadata?.role as string | undefined;
    if (role === "WORKER") {
      const isRestrictedAdminPath =
        path.startsWith("/settings") ||
        path.startsWith("/reports") ||
        path.startsWith("/audit") ||
        (path.startsWith("/api/") && 
         (path.startsWith("/api/settings") || 
          path.startsWith("/api/reports") || 
          path.startsWith("/api/audit")));
      
      if (isRestrictedAdminPath) {
        if (path.startsWith("/api/")) {
          return new NextResponse(
            JSON.stringify({ error: "Forbidden: Worker access restricted" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = "/pos";
        return NextResponse.redirect(url);
      }
    }

    // Refresh user activity timestamp
    response.cookies.set("rms_last_activity", now.toString(), {
      maxAge: 600,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });

    return response;
  }

  // --- 2. FALLBACK SLOW PATH (Network Auth check & token refresh) ---
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

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // --- Session Inactivity Check (10 Minutes) ---
  const lastActivityStr = request.cookies.get("rms_last_activity")?.value;
  const now = Date.now();
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

  if (!lastActivityStr || now - parseInt(lastActivityStr) > INACTIVITY_TIMEOUT) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    url.searchParams.set("message", "Session expired due to inactivity.");

    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-") || cookie.name === "rms_last_activity") {
        redirectResponse.cookies.set(cookie.name, "", { maxAge: -1, path: "/" });
      }
    }
    return redirectResponse;
  }

  const role = user.app_metadata?.role as string | undefined;
  if (role === "WORKER") {
    const isRestrictedAdminPath =
      path.startsWith("/settings") ||
      path.startsWith("/reports") ||
      path.startsWith("/audit") ||
      (path.startsWith("/api/") && 
       (path.startsWith("/api/settings") || 
        path.startsWith("/api/reports") || 
        path.startsWith("/api/audit")));
    
    if (isRestrictedAdminPath) {
      if (path.startsWith("/api/")) {
        return new NextResponse(
          JSON.stringify({ error: "Forbidden: Worker access restricted" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/pos";
      return NextResponse.redirect(url);
    }
  }

  response.cookies.set("rms_last_activity", now.toString(), {
    maxAge: 600,
    path: "/",
    httpOnly: false,
    sameSite: "lax",
  });

  return response;
}

export const config = {
  // Run middleware on all paths except static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
