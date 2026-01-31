import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { VALID_EMAIL_OTP_TYPES } from "@/lib/constants/auth";

/**
 * Handles email change confirmation callback using PKCE flow with token_hash
 * Verifies the OTP token and redirects appropriately
 * Ensures cookies are properly set before redirecting
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const type: EmailOtpType | null = 
    typeParam && (VALID_EMAIL_OTP_TYPES as readonly string[]).includes(typeParam)
      ? (typeParam as EmailOtpType)
      : null;

  let supabaseResponse = NextResponse.next({
    request,
  });

  if (token_hash && type) {
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

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Email change confirmed successfully - redirect to protected page
      // Create redirect response and copy all cookies from supabaseResponse
      const redirectUrl = new URL("/protected", request.url);
      redirectUrl.searchParams.set("email_confirmed", "true");
      const redirectResponse = NextResponse.redirect(redirectUrl);

      // Copy all cookies that were set during verifyOtp
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(
          cookie.name,
          cookie.value,
          cookie,
        );
      });
      return redirectResponse;
    }
  }

  // Redirect to error page if something went wrong
  const errorUrl = new URL(`/auth/error?error=Failed to confirm email change`, request.url);
  const errorResponse = NextResponse.redirect(errorUrl);
  // Copy any cookies that were set
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    errorResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  return errorResponse;
}
