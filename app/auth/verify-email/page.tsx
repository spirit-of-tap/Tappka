import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/verify-email-form";

/**
 * Email verification page
 * Users can link an email via OTP to their Google OAuth account
 * Users with existing email identities can also access this page to add additional emails
 */
export default async function VerifyEmailPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Redirect to login if not authenticated
  if (!data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <VerifyEmailForm />
      </div>
    </div>
  );
}
