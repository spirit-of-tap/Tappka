import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { hasEmailIdentity, hasLinkedProfile } from "@/lib/auth-helpers";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";

/**
 * Pending approval page
 * Shown to users who have verified their email but don't have a linked profile yet
 */
export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Redirect to login if not authenticated
  if (!data?.claims) {
    redirect("/auth/login");
  }

  // Redirect to verify email if no email identity linked
  const hasEmail = await hasEmailIdentity(supabase);
  if (!hasEmail) {
    redirect("/auth/verify-email");
  }

  // Redirect to protected if already has linked profile
  const hasProfile = await hasLinkedProfile(supabase);
  if (hasProfile) {
    redirect(DEFAULT_LOGGED_IN_PAGE);
  }

  // Get user's email address
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email || "your email";

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 relative">
      <div className="absolute top-6 right-6 md:top-10 md:right-10">
        <LogoutButton />
      </div>
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Pending Approval</h1>
            <p className="text-muted-foreground">
              Your email address has been verified, but you need an admin to approve your account before you can access protected areas.
            </p>
          </div>
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                Please contact an administrator to approve your email address. Once approved, you will be able to access all protected areas of the application.
              </p>
              <div className="pt-2 border-t">
                <p className="text-sm font-medium">Your email address:</p>
                <p className="text-sm text-muted-foreground font-mono">{userEmail}</p>
              </div>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/verify-email">Change email address</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
