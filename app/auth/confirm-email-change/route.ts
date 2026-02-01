import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import {
  createErrorUrl,
  createSuccessUrl,
  redirectWithCookies,
} from "@/lib/auth-helpers";

/**
 * Handles email change confirmation callback using PKCE flow with token_hash
 * Verifies the OTP token and redirects appropriately
 * Ensures cookies are properly set before redirecting
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const next = searchParams.get("next");
  const startTime = searchParams.get("start_time");
  const type: EmailOtpType | null =
    typeParam === "email_change" ? ("email_change" as EmailOtpType) : null;

  if (!type) {
    return NextResponse.redirect(createErrorUrl(request, "Invalid type"));
  }
  if (!token_hash) {
    return NextResponse.redirect(createErrorUrl(request, "Invalid token hash"));
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


  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });
  if (error) {
    return redirectWithCookies(createErrorUrl(request, error.message), supabaseResponse);
  }

  // Redirect to verification success page with timestamp if available
  const successUrl = request.nextUrl.clone();
  successUrl.pathname = "/auth/verification-success";
  successUrl.search = "";
  
  if (startTime) {
    successUrl.searchParams.set("start_time", startTime);
  }
  
  if (next) {
    successUrl.searchParams.set("next", next);
  }

  return redirectWithCookies(successUrl, supabaseResponse);
}
