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

  // If no email identity, redirect to onboarding page (wizard for first-time users)
  // Treat errors as "no identity" to preserve graceful redirect behavior
  const emailIdentityCheck = await safeCheck(
    () => hasEmailIdentity(supabase, authUser),
    "hasEmailIdentity",
  );
  if (!emailIdentityCheck.ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/onboarding";
    url.search = ""; // Clear existing search params
    url.hash = ""; // Clear existing hash
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // Check for linked profile if user is authenticated and not on public routes
  // Treat errors as "no profile" to preserve graceful redirect behavior
  const linkedProfileCheck = await safeCheck(
    () => hasLinkedProfile(supabase, authUser),
    "hasLinkedProfile",
  );
  if (!linkedProfileCheck.ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/onboarding";
    url.search = ""; // Strip all query parameters (e.g., from email verification or QR code)
    url.hash = ""; // Strip hash as well
    url.searchParams.set("next", fullPath);
    return redirectWithCookies(url, supabaseResponse);
  }

  // For protected routes (dashboard, etc.), we need to check verification
  // This is done on the page level for better UX with proper error messages

  return supabaseResponse;
}
