import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { hasEmailIdentity } from "@/lib/auth-helpers";
import { validateRedirectUrl } from "@/lib/utils";

/**
 * Handles OAuth callback from Google
 * Exchanges the code for a session and redirects appropriately
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    redirect(`/auth/error?error=${encodeURIComponent("No code provided")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  // Check if user has email identity linked
  // If not, redirect to verify-email page
  // Use the same supabase client to ensure we have the just-exchanged session
  const hasEmail = await hasEmailIdentity(supabase);

  // Validate the next parameter to prevent open redirects
  const validatedNext = validateRedirectUrl(next, origin);
  const redirectTo = validatedNext ?? (hasEmail ? "/protected" : "/auth/verify-email");

  redirect(redirectTo);
}
