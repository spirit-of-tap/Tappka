import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/auth-helpers";
import { getCoachUnreadCount } from "@/lib/essays/queries";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
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
  const supabase = await createClient();

  // Get profile for user info in sidebar (no separate getUser() needed)
  const profile = await getCurrentUserProfile(supabase);

  const sidebarUser = {
    id: profile?.id || "",
    name: profile?.name || "Uživatel",
    email: profile?.work_email || "",
    role: profile?.role,
  };

  const isCoachOrAdmin = profile?.role === "coach" || profile?.role === "admin";
  const reviewCount =
    isCoachOrAdmin && profile?.team_id
      ? await getCoachUnreadCount(supabase, profile.id, profile.team_id)
      : 0;

  return (
    <SidebarProvider>
      <AppSidebar user={sidebarUser} reviewCount={reviewCount} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
        <footer className="border-t p-4">
          <p className="text-center text-xs text-muted-foreground">
            Tiimiakatemia Prague {new Date().getFullYear()}
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
