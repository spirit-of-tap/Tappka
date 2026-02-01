import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicRoute, DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { hasEmailIdentity, hasLinkedProfile, redirectWithCookies } from "@/lib/auth-helpers";
import { validateRedirectUrl } from "@/lib/utils";

/**
 * Safely executes an async check function, catching any errors
 * and treating them as a failed check to preserve graceful redirect behavior
 * @param checkFn - The async function to execute
 * @param checkName - Name of the check for logging purposes
 * @returns Object with ok boolean and optional error
 */
async function safeCheck(
  checkFn: () => Promise<boolean>,
  checkName: string,
): Promise<{ ok: boolean; error?: Error }> {
  try {
    const result = await checkFn();
    return { ok: result };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`Error in ${checkName}:`, err);
    return { ok: false, error: err };
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const pathname = request.nextUrl.pathname;
  // Include full path with query parameters and hash for next parameter
  const fullPath = pathname + request.nextUrl.search + request.nextUrl.hash;

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // Handle authenticated users visiting login page - redirect them
    if (pathname === "/auth/login") {
      // Use getUser() instead of getClaims() to validate the user actually exists
      // getClaims() can return truthy values even with invalid/deleted users
      const { data: { user }, error } = await supabase.auth.getUser();

      // Only redirect if we have a valid user (not just claims)
      // This prevents infinite redirect loops when token is invalid but claims exist
      if (!error && user) {
        // Get next parameter from query string
        const next = request.nextUrl.searchParams.get("next");

        // Validate next parameter to prevent open redirects
        const origin = request.nextUrl.origin;
        const validatedNext = next ? validateRedirectUrl(next, origin) : null;
        const redirectTo = validatedNext ?? DEFAULT_LOGGED_IN_PAGE;

        const url = request.nextUrl.clone();
        url.pathname = redirectTo;
        url.search = ""; // Clear existing search params
        url.hash = ""; // Clear existing hash
        return redirectWithCookies(url, supabaseResponse);
      }
    }
    return supabaseResponse;
  }

  // Redirect to login if not authenticated
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = ""; // Clear existing search params
    url.hash = ""; // Clear existing hash
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // Check if user has an email identity (not just OAuth providers like Google)
  const { data: getUserData, error } = await supabase.auth.getUser();
  const authUser = getUserData?.user;

  if (error) {
    console.error("supabase.auth.getUser error", error);
  }

  if (!authUser) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = ""; // Clear existing search params
    url.hash = ""; // Clear existing hash
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // If no email identity, redirect to verify email page
  // Treat errors as "no identity" to preserve graceful redirect behavior
  const emailIdentityCheck = await safeCheck(
    () => hasEmailIdentity(supabase),
    "hasEmailIdentity",
  );
  if (!emailIdentityCheck.ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/verify-email";
    url.search = ""; // Clear existing search params
    url.hash = ""; // Clear existing hash
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // Check for linked profile if user is authenticated and not on public routes
  // Skip this check for verify-email and pending-approval routes
  // Treat errors as "no profile" to preserve graceful redirect behavior
  const linkedProfileCheck = await safeCheck(
    () => hasLinkedProfile(supabase),
    "hasLinkedProfile",
  );
  if (!linkedProfileCheck.ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/pending-approval";
    url.search = ""; // Strip all query parameters (e.g., from email verification or QR code)
    url.hash = ""; // Strip hash as well
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
