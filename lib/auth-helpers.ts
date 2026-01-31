import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { createServerClient } from "@supabase/ssr";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

type SupabaseClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServerClient>;

/**
 * Checks if the authenticated user has an email identity linked
 * (not just OAuth providers like Google)
 * @param supabaseClient - Supabase client to use. Must be provided to use existing client.
 * @returns true if user has an email identity, false otherwise
 */
export async function hasEmailIdentity(
  supabaseClient: SupabaseClient
): Promise<boolean> {
  const { data: { user }, error } = await supabaseClient.auth.getUser();

  if (error || !user) {
    return false;
  }

  // Check if user has an email identity (not just OAuth)
  // User identities include: email, google, etc.
  // We need at least one email identity
  const identities = user.identities || [];

  // Check if any identity is an email identity (not OAuth)
  return identities.some(
    (identity: { provider: string }) => identity.provider === "email"
  );
}

/**
 * Checks if the authenticated user has a linked profile
 * @param supabaseClient - Supabase client to use. Must be provided to use existing client.
 * @returns true if user has a linked profile, false otherwise
 */
export async function hasLinkedProfile(
  supabaseClient: SupabaseClient
): Promise<boolean> {
  const { data: { user }, error } = await supabaseClient.auth.getUser();

  if (error || !user) {
    return false;
  }

  // Single query using nested select to check for linked profile
  // Joins users and profiles tables in a single database call
  const { data: userWithProfile } = await supabaseClient
    .from("users")
    .select("profiles(id)")
    .eq("auth_user_id", user.id)
    .single();

  return !!userWithProfile?.profiles && userWithProfile.profiles.length > 0;
}

/**
 * Creates an error URL with the given error message
 */
export function createErrorUrl(request: NextRequest, errorMessage: string): URL {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/error";
  url.searchParams.set("error", errorMessage);
  return url;
}

/**
 * Creates a success redirect URL
 */
export function createSuccessUrl(request: NextRequest): URL {
  const url = request.nextUrl.clone();
  url.pathname = DEFAULT_LOGGED_IN_PAGE;
  return url;
}

/**
 * Creates a redirect response with cookies copied from supabaseResponse
 * Preserves all cookie options (httpOnly, secure, sameSite, etc.)
 */
export function redirectWithCookies(
  url: URL,
  supabaseResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  const setCookieHeaders = supabaseResponse.headers.getSetCookie();
  setCookieHeaders.forEach((cookieHeader) => {
    redirectResponse.headers.append("Set-Cookie", cookieHeader);
  });
  return redirectResponse;
}
