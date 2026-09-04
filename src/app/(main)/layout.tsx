import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/session";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import { SpotlightProvider } from "@/components/spotlight";
import { PostHogIdentify } from "@/components/posthog/posthog-identify";
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
  };

  return (
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
    </SpotlightProvider>
  );
}
