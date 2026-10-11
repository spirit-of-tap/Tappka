import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { canAccessFeature } from "@/lib/feature-access";
import { createClient } from "@/lib/supabase/server";
import { getActiveTimer } from "@/lib/time-tracking/queries";
import type { TimeEntryWithTag } from "@/lib/time-tracking/types";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { SpotlightProvider } from "@/components/spotlight";
import { PostHogIdentify } from "@/components/posthog/posthog-identify";
import { LongTimerAlert } from "@/components/time-tracking/long-timer-alert";
import { TimerProvider } from "@/components/time-tracking/timer-provider";
import { TimerSheets } from "@/components/time-tracking/timer-sheets";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();

  // Linked-profile gate (moved here from the middleware): an authenticated,
  // email-verified user without an admin-linked profile sees the onboarding
  // waiting screen. x-pathname is stamped by the proxy so the deep link
  // survives onboarding.
  if (!profile) {
    const headersList = await headers();
    const fullPath = headersList.get("x-pathname");
    redirect(
      fullPath
        ? `/auth/onboarding?next=${encodeURIComponent(fullPath)}`
        : "/auth/onboarding",
    );
  }

  const sidebarUser = {
    id: profile.id,
    name: profile.name ?? "",
    email: profile.work_email,
    role: profile.role,
    beta_access: profile.beta_access_granted_at != null,
    beta_access_granted_at: profile.beta_access_granted_at,
    beta_cohort: ((profile as unknown as { beta_cohort: "A" | "B" }).beta_cohort ?? "A") as "A" | "B",
    teamId: profile.team_id ?? null,
    teamName: profile.team?.name ?? null,
  };

  const canAccessTimeTracking = canAccessFeature(sidebarUser, "timeTracking");
  let initialActiveTimer: TimeEntryWithTag | null = null;
  if (canAccessTimeTracking) {
    try {
      const supabase = await createClient();
      initialActiveTimer = await getActiveTimer(supabase, profile.id);
    } catch (error) {
      // Never break the whole app shell over the timer — the client
      // provider re-reads it after the first mutation.
      console.error("Failed to load the active timer", error);
    }
  }

  return (
    <TimerProvider
      initialActive={initialActiveTimer}
      canAccess={canAccessTimeTracking}
      serverNow={new Date().getTime()}
    >
      <SpotlightProvider user={sidebarUser}>
        <PostHogIdentify
          distinctId={profile.id}
          role={profile.role}
          betaAccess={profile.beta_access_granted_at != null}
          betaCohort={sidebarUser.beta_cohort}
          teamId={profile.team_id}
        />
        <SidebarProvider>
          <AppSidebar user={sidebarUser} />
          <SidebarInset>
            <main className="flex flex-1 flex-col gap-4 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4">{children}</main>
            <footer className="hidden border-t p-4 md:block">
              <p className="text-center text-xs text-muted-foreground">
                Tiimiakatemia Prague {new Date().getFullYear()}
              </p>
            </footer>
          </SidebarInset>
        </SidebarProvider>
        <MobileBottomNav />
        <TimerSheets />
        <LongTimerAlert />
      </SpotlightProvider>
    </TimerProvider>
  );
}
