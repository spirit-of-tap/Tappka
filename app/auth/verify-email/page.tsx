import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/verify-email-form";
import { LogoutButton } from "@/components/logout-button";
import { hasLinkedProfile } from "@/lib/auth-helpers";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";

/**
 * Email verification page
 * Users can link an email via OTP to their Google OAuth account
 * Users with existing email identities can also access this page to add additional emails
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Redirect to login if not authenticated
  if (!data?.claims) {
    redirect("/auth/login");
  }

  // Get search params once
  const params = await searchParams;
  const next = params.next;

  // Redirect to protected if already has linked profile
  // Respect the next parameter if provided, otherwise use default logged in page
  const hasProfile = await hasLinkedProfile(supabase);
  if (hasProfile) {
    redirect(next ?? DEFAULT_LOGGED_IN_PAGE);
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 relative">
      <div className="absolute top-6 right-6 md:top-10 md:right-10">
        <LogoutButton />
      </div>
      <div className="w-full max-w-sm">
        <VerifyEmailForm next={next} />
      </div>
    </div>
  );
}
