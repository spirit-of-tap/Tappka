import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getModuleForPath } from "@/lib/navigation";
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

  // The x-pathname header (stamped by the proxy) drives both the onboarding
  // deep link and the breadcrumb's current-module crumb.
  //
  // Linked-profile gate (moved here from the middleware): an authenticated,
  // email-verified user without an admin-linked profile sees the onboarding
  // waiting screen — the deep link survives onboarding.
  const headersList = await headers();
  const fullPath = headersList.get("x-pathname");
  if (!profile) {
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

  const crumbModule = getModuleForPath(fullPath);

  return (
    <>
      <SidebarProvider>
        <AppSidebar user={sidebarUser} />
        <SidebarInset>
          <header className="hidden h-16 shrink-0 items-center gap-2 border-b px-4 md:flex">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                {crumbModule && (
                  <>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href={crumbModule.url}>
                        {crumbModule.title}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4">{children}</main>
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
