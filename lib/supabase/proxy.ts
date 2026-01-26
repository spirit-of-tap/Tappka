import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/auth/sign-up", "/auth/forgot-password", "/auth/error"];

// Routes that require auth but NOT verification (semi-protected)
const SEMI_PROTECTED_ROUTES = ["/verify", "/auth/update-password"];

// API routes that should be handled separately
const API_ROUTES = ["/api/"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const pathname = request.nextUrl.pathname;

  // Allow API routes through (they handle their own auth)
  if (API_ROUTES.some((route) => pathname.startsWith(route))) {
    return supabaseResponse;
  }

  // Check if it's a public route
  const isPublicRoute =
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next");

  // Check if it's a semi-protected route (needs auth, not verification)
  const isSemiProtectedRoute = SEMI_PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // No user - redirect to login unless on public route
  if (!user) {
    if (!isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // User is logged in
  // If on public routes (except password update), redirect to dashboard or verify
  if (isPublicRoute && !pathname.startsWith("/auth/update-password")) {
    // We'll do verification check on the page level for better UX
    // Just redirect logged-in users away from login/signup
    if (pathname === "/" || pathname === "/auth/sign-up") {
      const url = request.nextUrl.clone();
      // Redirect to dashboard - the page will handle verification check
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // For semi-protected routes, just allow through (verify page handles its own logic)
  if (isSemiProtectedRoute) {
    return supabaseResponse;
  }

  // For protected routes (dashboard, etc.), we need to check verification
  // This is done on the page level for better UX with proper error messages

  return supabaseResponse;
}
