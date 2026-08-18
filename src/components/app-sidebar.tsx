"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Mail,
  Database,
  ChevronRight,
  Heart,
  BookOpen,
  Handshake,
  GraduationCap,
  NotebookPen,
  Activity,
  Wrench,
  Brain,
  Files,
} from "lucide-react"

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

// Navigation data for Tappka
const getNavData = (isDevelopment: boolean, _isCoachOrAdmin: boolean, _reviewCount: number): NavData => ({
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
          title: "Zák. schůzky",
          url: "/schuzky",
          icon: Handshake,
        },
        {
          title: "Koučování",
          url: "/koucovani",
          icon: GraduationCap,
        },
        {
          title: "Týmová reflexe",
          url: "/tymova-reflexe",
          icon: NotebookPen,
        },
        {
          title: "Týmový deník",
          url: "/tymovy-denik",
          icon: Activity,
        },
        {
          title: "Týmové dokumenty",
          url: "/tymove-dokumenty",
          icon: Files,
        },
        {
          title: "Nástroje a techniky",
          url: "/nastroje-techniky",
          icon: Wrench,
        },
        {
          title: "Osobnostní testy",
          url: "/komunita/profil",
          icon: Brain,
        },
        {
          title: "Čtení",
          url: "/cteni/prehled",
          icon: BookOpen,
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
    beta_access?: boolean
  }
  reviewCount?: number
}

function AppSidebarContent({ user, reviewCount = 0 }: { user?: AppSidebarProps["user"]; reviewCount?: number }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { setOpenMobile } = useSidebar()
  const isCoachOrAdmin = user?.role === "coach" || user?.role === "admin"
  const isBeta = user?.beta_access ?? false
  const isReservationsActive = pathname.startsWith("/reservations")
  const isSchuzkyActive = pathname.startsWith("/schuzky")
  const isKoucovaniActive = pathname.startsWith("/koucovani")
  const isTymovaReflexeActive = pathname.startsWith("/tymova-reflexe")
  const isTymovyDenikActive = pathname.startsWith("/tymovy-denik")
  const isTymoveDokumentyActive = pathname.startsWith("/tymove-dokumenty")
  const isNastrojeTechnikyActive = pathname.startsWith("/nastroje-techniky")
  const isCteniActive = pathname.startsWith("/cteni")
  const cteniSubItems = [
    { title: "Přehled", url: "/cteni/prehled" },
    { title: "Hledat", url: "/cteni/hledat" },
    ...(isCoachOrAdmin
      ? [
        { title: "Ke kontrole", url: "/cteni/eseje/ke-kontrole", badge: reviewCount },
        { title: "Správa knihovny", url: "/cteni/sprava" },
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

                  // Zák. schůzky — beta-only
                  if (item.title === "Zák. schůzky") {
                    if (!isBeta) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isSchuzkyActive}
                          tooltip={item.title}
                        >
                          <Link href={item.url} onClick={closeSidebarOnMobile}>
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

                  // Koučování — beta-only
                  if (item.title === "Koučování") {
                    if (!isBeta) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isKoucovaniActive}
                          tooltip={item.title}
                        >
                          <Link href={item.url} onClick={closeSidebarOnMobile}>
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

                  // Týmová reflexe — beta-only
                  if (item.title === "Týmová reflexe") {
                    if (!isBeta) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isTymovaReflexeActive}
                          tooltip={item.title}
                        >
                          <Link href={item.url} onClick={closeSidebarOnMobile}>
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

                  // Týmový deník — beta-only
                  if (item.title === "Týmový deník") {
                    if (!isBeta) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isTymovyDenikActive}
                          tooltip={item.title}
                        >
                          <Link href={item.url} onClick={closeSidebarOnMobile}>
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

                  // Týmové dokumenty — beta-only
                  if (item.title === "Týmové dokumenty") {
                    if (!isBeta) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isTymoveDokumentyActive}
                          tooltip={item.title}
                        >
                          <Link href={item.url} onClick={closeSidebarOnMobile}>
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

                  // Nástroje a techniky — beta-only
                  if (item.title === "Nástroje a techniky") {
                    if (!isBeta) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isNastrojeTechnikyActive}
                          tooltip={item.title}
                        >
                          <Link href={item.url} onClick={closeSidebarOnMobile}>
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
                            onClick={closeSidebarOnMobile}
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

                  // Čtení — beta-only
                  if (item.title === "Čtení") {
                    if (!isBeta) return null

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
                              <Badge
                                variant="secondary"
                                className="ml-auto h-5 text-[10px] px-1.5"
                              >
                                Beta
                              </Badge>
                              <ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
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
                <Link href="/zpetna-vazba" onClick={closeSidebarOnMobile}>
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

export function AppSidebar({ user, reviewCount, ...props }: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <AppSidebarContent user={user} reviewCount={reviewCount} />
    </Sidebar>
  )
}
