import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { getCoachUnreadCount } from "@/lib/essays/queries";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
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
  };

  const isCoachOrAdmin = profile.role === "coach" || profile.role === "admin";
  let reviewCount = 0;
  if (isCoachOrAdmin && profile.team_id) {
    const supabase = await createClient();
    reviewCount = await getCoachUnreadCount(supabase, profile.id, profile.team_id);
  }

  return (
    <>
      <SidebarProvider>
        <AppSidebar user={sidebarUser} reviewCount={reviewCount} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <Separator
              orientation="vertical"
              className="mr-2 hidden md:block data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-4">{children}</main>
          <footer className="hidden border-t p-4 md:block">
            <p className="text-center text-xs text-muted-foreground">
              Tiimiakatemia Prague {new Date().getFullYear()}
            </p>
          </footer>
        </SidebarInset>
      </SidebarProvider>
      <MobileBottomNav />
    </>
  );
}
