import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/verify-email-form";
import { hasEmailIdentity } from "@/lib/auth-helpers";

/**
 * Email verification page
 * Users must link an email via OTP to their Google OAuth account
 */
export default async function VerifyEmailPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Redirect to login if not authenticated
  if (!data?.claims) {
    redirect("/auth/login");
  }

  // Redirect to protected if already has email identity
  const hasEmail = await hasEmailIdentity();
  if (hasEmail) {
    redirect("/protected");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <VerifyEmailForm />
      </div>
    </div>
  );
}
