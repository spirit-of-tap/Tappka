"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  ChevronRight,
  Database,
  Heart,
  Mail,
} from "lucide-react"

import { NAV_MODULES, type NavModule } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    id: string
    name: string
    email: string
    role?: string
    beta_access?: boolean
  }
}

function AppSidebarContent({ user }: { user?: AppSidebarProps["user"] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isCoachOrAdmin = user?.role === "coach" || user?.role === "admin"
  const isBeta = user?.beta_access ?? false
  const isReservationsActive = pathname.startsWith("/reservations")
  const isDevelopment = process.env.NODE_ENV === "development"

  const DEV_INSPECT_ITEMS: NavModule[] = [
    { title: "Mailpit", url: "http://127.0.0.1:54324", icon: Mail, description: "", external: true },
    { title: "Supabase Studio", url: "http://127.0.0.1:54323", icon: Database, description: "", external: true },
  ]

  const sections: { title: string; items: NavModule[] }[] = [
    { title: "Hlavní", items: NAV_MODULES },
    ...(isDevelopment ? [{ title: "Dev", items: DEV_INSPECT_ITEMS }] : []),
  ]

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="font-heading font-bold text-sm">T</span>
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-heading font-bold">Tappka</span>
            <span className="text-xs text-muted-foreground">Tiimiakatemia Prague</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  // Branch order is load-bearing for Osobnostní testy: it is
                  // betaOnly in NAV_MODULES but renders through its title
                  // special case below — the generic betaOnly branch must stay
                  // after it.

                  // Special handling for Rezervace with sub-menu for coach/admin
                  if (item.title === "Místnosti" && isCoachOrAdmin) {
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        defaultOpen={isReservationsActive}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={isReservationsActive}
                              tooltip={item.title}
                            >
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={(pathname === "/reservations" || pathname.startsWith("/reservations/")) && pathname !== "/reservations/settings"}
                                >
                                  <Link href="/reservations">
                                    Místnosti
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === "/reservations/settings"}
                                >
                                  <Link href="/reservations/settings">
                                    Nastavení
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )
                  }

                  // Osobnostní testy — own profile tests tab, beta-only
                  if (item.title === "Osobnostní testy") {
                    if (!isBeta || !user) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={
                            pathname.startsWith("/komunita/profil/") &&
                            searchParams.get("tab") === "osobnostni-testy"
                          }
                          tooltip={item.title}
                        >
                          <Link
                            href={`/komunita/profil/${user.id}?tab=osobnostni-testy`}
                          >
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                            <Badge
                              variant="secondary"
                              className="ml-auto h-5 text-[10px] px-1.5"
                            >
                              Beta
                            </Badge>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  }

                  // Beta-gated modules — badge item, hidden without beta access.
                  if (item.betaOnly) {
                    if (!isBeta) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                          tooltip={item.title}
                        >
                          <Link href={item.url}>
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                            <Badge
                              variant="secondary"
                              className="ml-auto h-5 text-[10px] px-1.5"
                            >
                              Beta
                            </Badge>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  }

                  // Standard menu item (internal or external)
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                      >
                        <Link
                          href={item.url}
                          {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      {user && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Zpětná vazba"
                isActive={pathname === "/zpetna-vazba"}
                className={cn(
                  "group/menu-button",
                  "bg-rose-50/60 text-rose-700",
                  "dark:bg-rose-950/40 dark:text-rose-300",
                  "data-[active=true]:bg-rose-100 data-[active=true]:text-rose-800",
                  "data-[active=true]:dark:bg-rose-900/60 data-[active=true]:dark:text-rose-200",
                  "hover:bg-rose-100 hover:text-rose-800",
                  "dark:hover:bg-rose-900/60 dark:hover:text-rose-200",
                  "border border-rose-200/50 dark:border-rose-800/40",
                )}
              >
                <Link href="/zpetna-vazba">
                  <Heart className="size-4 animate-pulse transition-transform group-data-[active=true]/menu-button:scale-110" />
                  <span className="font-medium">Zpětná vazba</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <NavUser user={user} />
        </SidebarFooter>
      )}
      <SidebarRail />
    </>
  )
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const { isMobile } = useSidebar()
  // Mobile gets the bottom navigation bar instead of the sidebar sheet.
  if (isMobile) return null
  return (
    <Sidebar {...props}>
      <AppSidebarContent user={user} />
    </Sidebar>
  )
}
