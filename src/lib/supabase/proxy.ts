import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicRoute, DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { redirectWithCookies } from "@/lib/auth-helpers";
import { validateRedirectUrl } from "@/lib/utils";

export async function updateSession(request: NextRequest) {
  // Expose the requested path to server components (the (main) layout uses it
  // to preserve ?next= on its onboarding redirect).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-pathname",
    request.nextUrl.pathname + request.nextUrl.search,
  );

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers?: Headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          // @supabase/ssr 0.8+ passes cache headers (Cache-Control: no-store
          // etc.) that must reach the response so CDNs never cache a page
          // that just set auth cookies.
          headers?.forEach((value, key) =>
            supabaseResponse.headers.set(key, value)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // getClaims() refreshes an expired session and, with asymmetric signing
  // keys, verifies the JWT locally — no network round trip. Removing it
  // breaks session refresh ("users may be randomly logged out").
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  const pathname = request.nextUrl.pathname;
  // Include full path with query parameters and hash for next parameter
  const fullPath = pathname + request.nextUrl.search + request.nextUrl.hash;

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // Handle authenticated users visiting login page - redirect them.
    // getUser() (a network call) is intentionally kept on this rare path:
    // getClaims() can be truthy for a deleted user until the token expires,
    // and redirecting such a user into the app and back here would loop.
    if (pathname === "/auth/login" && claims) {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (!error && user) {
        const next = request.nextUrl.searchParams.get("next");
        const origin = request.nextUrl.origin;
        const validatedNext = next ? validateRedirectUrl(next, origin) : null;
        const redirectTo = validatedNext ?? DEFAULT_LOGGED_IN_PAGE;

        const url = request.nextUrl.clone();
        url.pathname = redirectTo;
        url.search = "";
        url.hash = "";
        return redirectWithCookies(url, supabaseResponse);
      }
    }
    return supabaseResponse;
  }

  // Redirect to login if not authenticated
  if (!claims) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.hash = "";
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // Users who signed in via OAuth only (no verified CZU email identity) go to
  // the onboarding wizard. app_metadata.providers is baked into the JWT, so
  // this needs no getUser() round trip. The claim is refreshed the moment it
  // matters: verify-email-form calls refreshSession() right after the email
  // identity is added.
  const providers: string[] =
    (claims.app_metadata as { providers?: string[] } | undefined)?.providers ??
    [];
  if (!providers.includes("email")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/onboarding";
    url.search = "";
    url.hash = "";
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // The linked-profile gate lives in app/(main)/layout.tsx, which already
  // fetches the profile for the sidebar — no extra queries here.

  return supabaseResponse;
}
