import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  createErrorUrl,
  redirectWithCookies,
  hasEmailIdentity,
} from "@/lib/auth-helpers";
import { validateRedirectUrl } from "@/lib/utils";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

/**
 * Handles OAuth callback from Google
 * Exchanges the code for a session and redirects appropriately
 * Ensures cookies are properly set before redirecting
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(createErrorUrl(request, "No code provided"));
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return redirectWithCookies(createErrorUrl(request, error.message), supabaseResponse);
  }

  // Check if user has email identity linked
  // If not, redirect to verify-email page
  // Use the same supabase client to ensure we have the just-exchanged session
  const hasEmail = await hasEmailIdentity(supabase);

  // Validate the next parameter to prevent open redirects
  const validatedNext = validateRedirectUrl(next, origin);
  const redirectTo = validatedNext ?? (hasEmail ? DEFAULT_LOGGED_IN_PAGE : "/auth/verify-email");

  const url = request.nextUrl.clone();
  url.pathname = redirectTo;
  return redirectWithCookies(url, supabaseResponse);
}
