import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { createServerClient } from "@supabase/ssr";
import type { createBrowserClient } from "@supabase/ssr";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { validateRedirectUrl } from "@/lib/utils";

type SupabaseClient =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof createServerClient>
  | ReturnType<typeof createBrowserClient>;

/**
 * Profile role enum matching database profile_role type
 */
export type ProfileRole = 'student' | 'team_leader' | 'coach' | 'admin';

/**
 * Profile type matching the profiles table schema
 */
export interface Profile {
  id: string;
  name: string;
  picture: string | null;
  user_id: string | null;
  work_email: string;
  role: ProfileRole;
  team_id: string | null;
  phone_number: string | null;
  personal_email: string | null;
  date_of_birth: string | null;
  removed_access: string | null;
  removed_access_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Team type matching the teams table schema
 */
export interface Team {
  id: string;
  name: string;
  picture: string | null;
  color: string | null;
  year: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Profile with team data included
 */
export interface ProfileWithTeam extends Profile {
  team: Team | null;
}

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
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    return false;
  }

  // Query profiles directly - RLS policy ensures user can only see their own profile
  // The RLS policy checks: user_id in (select id from public.users where auth_user_id = auth.uid())
  // This is more reliable than nested selects with RLS
  const { data: profiles, error: queryError } = await supabaseClient
    .from("profiles")
    .select("id")
    .limit(1);

  // Return false if query failed or no profiles found
  if (queryError || !profiles) {
    return false;
  }

  // Check if at least one profile exists
  return Array.isArray(profiles) && profiles.length > 0;
}

/**
 * Gets the current authenticated user's profile, optionally with team data included
 * Uses RLS policy to ensure user can only see their own profile
 * @param supabaseClient - Supabase client to use. Must be provided to use existing client.
 * @param includeTeam - Whether to fetch team data along with the profile. Defaults to true.
 * @returns The profile data with team (if includeTeam is true) or null otherwise
 */
export async function getCurrentUserProfile(
  supabaseClient: SupabaseClient,
  includeTeam: boolean = false,
): Promise<ProfileWithTeam | null> {
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Build select query conditionally based on includeTeam parameter
  const selectQuery = includeTeam
    ? `
      *,
      team:teams(*)
    `
    : "*";

  // Query profiles - RLS policy ensures user can only see their own profile
  // The RLS policy checks: user_id in (select id from public.users where auth_user_id = auth.uid())
  const { data: profile, error: queryError } = await supabaseClient
    .from("profiles")
    .select(selectQuery)
    .limit(1)
    .single();

  // Return null if query failed or no profile found
  if (queryError || !profile) {
    return null;
  }

  // Transform the response to match ProfileWithTeam interface
  // If team was fetched, extract it; otherwise set to null
  const team = includeTeam ? ((profile as any).team || null) : null;

  return {
    ...profile,
    team,
  } as ProfileWithTeam;
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
 * @param request - The NextRequest object
 * @param next - Optional next parameter to redirect to after success
 * @returns URL object for redirect
 */
export function createSuccessUrl(request: NextRequest, next?: string | null): URL {
  const url = request.nextUrl.clone();

  if (next) {
    // Validate next parameter to prevent open redirects
    const validatedNext = validateRedirectUrl(next, request.nextUrl.origin);
    if (validatedNext) {
      // Parse the redirect URL to handle query parameters and hash properly
      const redirectUrl = new URL(validatedNext, request.nextUrl.origin);
      url.pathname = redirectUrl.pathname;
      url.search = redirectUrl.search;
      url.hash = redirectUrl.hash;
      return url;
    }
  }

  url.pathname = DEFAULT_LOGGED_IN_PAGE;
  url.search = ""; // Clear any existing search params
  url.hash = ""; // Clear any existing hash
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
