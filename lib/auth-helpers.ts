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
export type ProfileRole = 'student' | 'mentor' | 'coach' | 'admin';

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
  team: Team | null;
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
 * Checks if the authenticated user has an email identity linked
 * (not just OAuth providers like Google)
 * @param supabaseClient - Supabase client to use. Must be provided to use existing client.
 * @returns true if user has an email identity, false otherwise
 */
export async function hasEmailIdentity(
  supabaseClient: SupabaseClient,
  preloadedUser?: { identities?: Array<{ provider: string }> } | null,
): Promise<boolean> {
  const user = preloadedUser ?? (await supabaseClient.auth.getUser()).data?.user;

  if (!user) {
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
  supabaseClient: SupabaseClient,
  preloadedUser?: { id: string } | null,
): Promise<boolean> {
  const profile = await getCurrentUserProfile(supabaseClient, { user: preloadedUser ?? undefined });
  return profile !== null;
}

/**
 * Gets the current authenticated user's profile, optionally with team data included
 * Explicitly filters by the current user's linked profile
 * @param supabaseClient - Supabase client to use. Must be provided to use existing client.
 * @param options - Optional config: includeTeam (fetch team data), user (pre-fetched auth user to skip getUser() call)
 * @returns The profile data with team populated (if includeTeam is true) or null if not found
 */
export async function getCurrentUserProfile(
  supabaseClient: SupabaseClient,
  options: { includeTeam?: boolean; user?: { id: string } } = {},
): Promise<Profile | null> {
  const { includeTeam = false } = options;

  // Use pre-fetched user if provided, otherwise fetch
  let authUserId: string;
  if (options.user) {
    authUserId = options.user.id;
  } else {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return null;
    }
    authUserId = user.id;
  }

  // First get the user's linked public.users record
  // This is required because profiles RLS has a permissive policy that allows
  // viewing all profiles, so we can't rely on RLS alone
  const { data: userData, error: userError } = await supabaseClient
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .limit(1)
    .maybeSingle();

  // If no users record exists for this auth user, they don't have a linked profile
  if (userError || !userData) {
    return null;
  }

  // Build select query conditionally based on includeTeam parameter
  const selectQuery = includeTeam
    ? `
      *,
      team:teams(*)
    `
    : "*";

  // Query profiles explicitly filtered by the user's user_id
  const { data: profile, error: queryError } = await supabaseClient
    .from("profiles")
    .select(selectQuery)
    .eq("user_id", userData.id)
    .limit(1)
    .maybeSingle();

  // Return null if query failed or no profile found
  if (queryError) {
    console.error("Error fetching user profile:", queryError);
    return null;
  }

  if (!profile) {
    return null;
  }

  // Transform the response to match Profile interface
  // Supabase returns foreign key relationships as objects (not arrays) for many-to-one relationships
  // If team was fetched, extract it; otherwise set to null
  let team: Team | null = null;
  if (includeTeam) {
    const teamData = (profile as any).team;
    // Handle both array and object responses (though it should be an object for many-to-one)
    if (Array.isArray(teamData)) {
      team = teamData.length > 0 ? (teamData[0] as Team) : null;
    } else if (teamData && typeof teamData === 'object') {
      team = teamData as Team;
    }
  }

  // Remove the team property from profile if it exists (to avoid duplication)
  const { team: _, ...profileWithoutTeam } = profile as any;

  return {
    ...profileWithoutTeam,
    team,
  } as Profile;
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
