"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  Users,
  Settings,
  HelpCircle,
  BookOpen,
  Mail,
  Database,
} from "lucide-react"

import { SearchForm } from "@/components/search-form"
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
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"

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
      ],
    },
    {
      title: "Aktivity",
      items: [
        {
          title: "Rezervace",
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
    name: string
    email: string
    role?: string
  }
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const isCoachOrAdmin = user?.role === "coach" || user?.role === "admin"
  const isReservationsActive = pathname.startsWith("/reservations")
  const isKomunitaActive = pathname.startsWith("/komunita")
  const isDevelopment = process.env.NODE_ENV === "development"

  return (
    <Sidebar {...props}>
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
        <SearchForm />
      </SidebarHeader>
      <SidebarContent>
        {getNavData(isDevelopment).navMain.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  // Special handling for Rezervace with sub-menu for coach/admin
                  if (item.title === "Rezervace" && isCoachOrAdmin) {
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
                                  <Link href="/komunita/lide">
                                    Lidé
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={pathname === "/komunita/tymy" || pathname.startsWith("/komunita/tymy/")}
                                >
                                  <Link href="/komunita/tymy">
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
          <NavUser user={user} />
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
