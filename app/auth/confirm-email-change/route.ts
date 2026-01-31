import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

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
    typeParam === "email_change" ? ("email_change" as EmailOtpType) : null;

  if (!type) {
    redirect(`/auth/error?error=${encodeURIComponent("Invalid type")}`);
  }
  if (!token_hash) {
    redirect(`/auth/error?error=${encodeURIComponent("Invalid token hash")}`);
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
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  redirect(DEFAULT_LOGGED_IN_PAGE);
}
