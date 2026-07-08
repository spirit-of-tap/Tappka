"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Mail,
  Database,
  ChevronRight,
  MessageCircleQuestion,
  FileText,
  BriefcaseBusiness,
  Search,
  Settings,
  Inbox,
  BookOpen,
} from "lucide-react"

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

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  external?: boolean
  badge?: number
}

type NavSection = {
  title: string
  items: NavItem[]
}

type NavData = {
  navMain: NavSection[]
}

const HELP_DESK_URL =
  "https://teams.microsoft.com/l/channel/19%3Aea499f40a2864e03862e5b517fa824a8%40thread.tacv2/HelpDesk%20IT%20House?groupId=c84b63de-1603-4ba8-98a6-9825300c0f22&tenantId=f26a48e1-fc21-461a-b97f-ac5bd535f341"

// Navigation data for Tappka
const getNavData = (isDevelopment: boolean, isCoachOrAdmin: boolean, reviewCount: number): NavData => ({
  navMain: [
    {
      title: "Hlavní",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: LayoutDashboard,
        },
        {
          title: "Místnosti",
          url: "/reservations",
          icon: CalendarDays,
        },
        {
          title: "Komunita",
          url: "/komunita",
          icon: Users,
        },
        {
          title: "Čtení",
          url: "/prehled",
          icon: BookOpen,
        },
      ],
    },
    {
      title: "Portfolio",
      items: [
        {
          title: "Portfolio",
          url: "/portfolio",
          icon: BriefcaseBusiness,
        },
      ],
    },
    ...(isDevelopment
      ? [
        {
          title: "Dev",
          items: [
            {
              title: "Mailpit",
              url: "http://127.0.0.1:54324",
              icon: Mail,
              external: true,
            },
            {
              title: "Supabase Studio",
              url: "http://127.0.0.1:54323",
              icon: Database,
              external: true,
            },
          ],
        },
      ]
      : []),
  ],
})

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    id: string
    name: string
    email: string
    role?: string
  }
  reviewCount?: number
}

function AppSidebarContent({ user, reviewCount = 0 }: { user?: AppSidebarProps["user"]; reviewCount?: number }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const isCoachOrAdmin = user?.role === "coach" || user?.role === "admin"
  const isReservationsActive = pathname.startsWith("/reservations")
  const isCteniActive = pathname === "/prehled" || pathname === "/hledat" || pathname.startsWith("/eseje") || pathname.startsWith("/knihovna") || pathname.startsWith("/settings/kniha-knih")
  const cteniSubItems = [
    { title: "Přehled", url: "/prehled" },
    { title: "Hledat", url: "/hledat" },
    ...(isCoachOrAdmin
      ? [
        { title: "Ke kontrole", url: "/eseje/ke-kontrole", badge: reviewCount },
        { title: "Nastavení", url: "/settings/kniha-knih" },
      ]
      : []),
  ]
  const isDevelopment = process.env.NODE_ENV === "development"

  const closeSidebarOnMobile = () => {
    setOpenMobile(false)
  }

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
        {getNavData(isDevelopment, isCoachOrAdmin, reviewCount).navMain.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
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
                                  <Link href="/reservations" onClick={closeSidebarOnMobile}>
                                    Místnosti
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === "/reservations/settings"}
                                >
                                  <Link href="/reservations/settings" onClick={closeSidebarOnMobile}>
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

                  // Special handling for Čtení with sub-menu
                  if (item.title === "Čtení") {
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        defaultOpen={isCteniActive}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={isCteniActive}
                              tooltip={item.title}
                            >
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {cteniSubItems.map((sub) => (
                                <SidebarMenuSubItem key={sub.title}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={pathname === sub.url || (sub.url !== "/" && pathname.startsWith(sub.url + "/"))}
                                  >
                                    <Link href={sub.url} onClick={closeSidebarOnMobile}>
                                      {sub.title}
                                      {"badge" in sub && sub.badge !== undefined && sub.badge > 0 && (
                                        <Badge
                                          variant="destructive"
                                          className="ml-auto h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                                        >
                                          {sub.badge}
                                        </Badge>
                                      )}
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
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
                          onClick={item.external ? undefined : closeSidebarOnMobile}
                          {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-auto h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                            >
                              {item.badge}
                            </Badge>
                          )}
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
              <SidebarMenuButton asChild tooltip="HelpDesk">
                <a
                  href={HELP_DESK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircleQuestion className="size-4" />
                  <span>HelpDesk</span>
                </a>
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

export function AppSidebar({ user, reviewCount, ...props }: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <AppSidebarContent user={user} reviewCount={reviewCount} />
    </Sidebar>
  )
}
