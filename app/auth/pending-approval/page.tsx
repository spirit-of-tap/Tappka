import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { hasLinkedProfile } from "@/lib/auth-helpers";

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

  // Redirect to protected if already has linked profile
  const hasProfile = await hasLinkedProfile();
  if (hasProfile) {
    redirect("/protected");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">Pending Approval</h1>
            <p className="text-muted-foreground">
              Your email address has been verified, but you need an admin to approve your account before you can access protected areas.
            </p>
          </div>
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm">
              Please contact an administrator to approve your email address. Once approved, you will be able to access all protected areas of the application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
