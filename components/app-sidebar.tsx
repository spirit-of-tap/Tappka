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
  BookOpen,
  FileText,
  BriefcaseBusiness,
} from "lucide-react"

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
const getNavData = (isDevelopment: boolean): NavData => ({
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
      ],
    },
    {
      title: "Čtení",
      items: [
        {
          title: "BoB",
          url: "/knihovna",
          icon: BookOpen,
        },
        {
          title: "Přehled",
          url: "/prehled",
          icon: FileText,
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
}

function AppSidebarContent({ user }: { user?: AppSidebarProps["user"] }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const isCoachOrAdmin = user?.role === "coach" || user?.role === "admin"
  const isReservationsActive = pathname.startsWith("/reservations")
  const isKomunitaActive = pathname.startsWith("/komunita")
  const isDevelopment = process.env.NODE_ENV === "development"

  const isKnihovnaActive = pathname.startsWith("/knihovna")

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
        {getNavData(isDevelopment).navMain.map((section) => (
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

                  // Special handling for BoB: coach/admin get sub-menu with Správa
                  if (item.title === "BoB" && isCoachOrAdmin) {
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        defaultOpen={isKnihovnaActive}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={isKnihovnaActive}
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
                                  isActive={pathname === "/knihovna" || (pathname.startsWith("/knihovna/") && pathname !== "/settings/kniha-knih")}
                                >
                                  <Link href="/knihovna" onClick={closeSidebarOnMobile}>
                                    Katalog
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === "/settings/kniha-knih"}
                                >
                                  <Link href="/settings/kniha-knih" onClick={closeSidebarOnMobile}>
                                    Správa
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )
                  }

                  // Special handling for Komunita with sub-menu
                  if (item.title === "Komunita") {
                    return (
                      <Collapsible
                        key={item.title}
                        asChild
                        defaultOpen={isKomunitaActive}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              isActive={isKomunitaActive}
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
                                  isActive={pathname === "/komunita/lide" || (pathname.startsWith("/komunita/profil/"))}
                                >
                                  <Link href="/komunita/lide" onClick={closeSidebarOnMobile}>
                                    Lidé
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === "/komunita/tymy" || pathname.startsWith("/komunita/tymy/")}
                                >
                                  <Link href="/komunita/tymy" onClick={closeSidebarOnMobile}>
                                    Týmy
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
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

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <AppSidebarContent user={user} />
    </Sidebar>
  )
}
