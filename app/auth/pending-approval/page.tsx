import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { hasEmailIdentity, hasLinkedProfile } from "@/lib/auth-helpers";
import { DEFAULT_LOGGED_IN_PAGE } from "@/lib/constants/auth";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";
import { ProfileLinkRealtimeListener } from "@/components/profile-link-realtime-listener";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock } from "lucide-react";
import { ONBOARDING_TEXT } from "@/lib/constants/onboarding";

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

  const {
    stepIndicator,
    successMessage,
    mainText,
    processTitle,
    processList,
    timeEstimate,
    emailLabel,
    logoutButton,
  } = ONBOARDING_TEXT.pendingStep;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 relative">
      {/* Realtime listener for profile linking */}
      <ProfileLinkRealtimeListener />
      
      <div className="absolute top-6 right-6 md:top-10 md:right-10">
        <LogoutButton />
      </div>
      <div className="w-full max-w-md">
        <Card>
          {/* Progress bar showing completion */}
          <CardHeader className="space-y-4 pb-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{stepIndicator}</span>
                <span>100%</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-0">
            {/* Success indicator */}
            <div className="flex items-center gap-3 rounded-lg border bg-green-50 dark:bg-green-950/20 p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0" />
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                {successMessage}
              </p>
            </div>

            {/* Main content */}
            <div className="space-y-4">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold">Čekáme na schválení</h1>
                <p className="text-sm text-muted-foreground">
                  {mainText}
                </p>
              </div>

              {/* Process explanation */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <p className="text-sm font-medium">{processTitle}</p>
                <div className="space-y-2">
                  {processList.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time estimate */}
              <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{timeEstimate}</span>
              </div>

              {/* User email display */}
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {emailLabel}
                </p>
                <p className="text-sm font-mono">{userEmail}</p>
              </div>

              {/* Actions */}
              <Button asChild variant="outline" className="w-full">
                <Link href="/auth/verify-email">Změnit email</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
