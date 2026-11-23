"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowUpRight,
  Database,
  Mail,
  MessageSquareHeart,
} from "lucide-react"

import { getSidebarSections, type NavModule, type NavTone } from "@/lib/navigation"
import { canAccessFeature, type BetaCohort } from "@/lib/feature-access"
import { cn } from "@/lib/utils"
import { NavUser } from "@/components/nav-user"
import { SpotlightTrigger } from "@/components/spotlight"
import { useOptionalTimer } from "@/components/time-tracking/timer-provider"
import { TimerWidget } from "@/components/time-tracking/timer-widget"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    id: string
    name: string
    email: string
    role?: string
    beta_access?: boolean
    beta_access_granted_at?: string | null
    beta_cohort?: BetaCohort
    teamId?: string | null
    teamName?: string | null
  }
}

const NAV_ITEM_CLASS = "h-9 gap-2.5 px-2 data-[active=true]:font-semibold"

/** Section colour: the dot beside the title and the icon chip of every item. */
const TONE_CLASSES: Record<NavTone, { dot: string; chip: string }> = {
  shared: { dot: "bg-primary", chip: "bg-primary/10 text-primary" },
  individual: { dot: "bg-chart-5", chip: "bg-chart-5/15 text-chart-5" },
  team: { dot: "bg-chart-3", chip: "bg-chart-3/15 text-chart-3-strong" },
  neutral: { dot: "bg-muted-foreground", chip: "bg-muted text-muted-foreground" },
}

function NavIcon({ item, tone }: { item: NavModule; tone: NavTone }) {
  return (
    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", TONE_CLASSES[tone].chip)}>
      <item.icon className="size-3.5" aria-hidden />
    </span>
  )
}

function AppSidebarContent({ user }: { user?: AppSidebarProps["user"] }) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const timer = useOptionalTimer()
  const showTimer = timer?.canAccess ?? false
  const timerRunning = showTimer && timer?.active != null
  const accessProfile = user
    ? {
        role: user.role ?? "student",
        beta_access_granted_at:
          user.beta_access_granted_at ?? (user.beta_access ? "1970-01-01T00:00:00Z" : null) ?? null,
        beta_cohort: (user.beta_cohort ?? (user.beta_access ? "B" : "A")) as BetaCohort,
        teamId: user.teamId ?? null,
        teamName: user.teamName ?? null,
      }
    : null
  const isDevelopment = process.env.NODE_ENV === "development"

  const DEV_INSPECT_ITEMS: NavModule[] = [
    { title: "Mailpit", url: "http://127.0.0.1:54324", icon: Mail, description: "", external: true },
    { title: "Supabase Studio", url: "http://127.0.0.1:54323", icon: Database, description: "", external: true },
  ]

  const sections = getSidebarSections(
    isDevelopment ? DEV_INSPECT_ITEMS : [],
  )

  return (
    <>
      <SidebarHeader className="gap-3 pt-4">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-tap-red text-tap-white">
            <span className="font-heading font-bold text-sm">T</span>
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-heading font-bold">Tappka</span>
            <span className="text-xs text-muted-foreground">Tiimiakatemia Prague</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2">
          <SpotlightTrigger className="h-10 flex-1" placeholder="Hledat…" />
          {showTimer && !timerRunning && (
            <TimerWidget
              collapsed
              className="size-10 rounded-xl bg-primary/10 text-primary shadow-none hover:bg-primary/15"
            />
          )}
        </div>
        {timerRunning && (
          <div className="px-2">
            <TimerWidget collapsed={state === "collapsed"} />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        {sections
          .filter((section) =>
            section.items.some((item) => !item.feature || canAccessFeature(accessProfile, item.feature)),
          )
          .map((section) => (
          <SidebarGroup key={section.title} className="py-1">
            <div className="px-2 pt-2 pb-1.5">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span aria-hidden className={cn("size-2 rounded-full", TONE_CLASSES[section.tone].dot)} />
                {section.title}
              </p>
              {section.hint && <p className="pl-4 text-xs text-muted-foreground">{section.hint}</p>}
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  // Feature-gated modules — badge item, hidden without cohort access.
                  if (item.feature) {
                    if (!canAccessFeature(accessProfile, item.feature)) return null

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                          className={NAV_ITEM_CLASS}
                          tooltip={item.title}
                        >
                          <Link href={item.url}>
                            <NavIcon item={item} tone={section.tone} />
                            <span>{item.title}</span>
                            <span
                              title="Beta"
                              className="ml-auto size-1.5 shrink-0 rounded-full bg-chart-2"
                            >
                              <span className="sr-only">Beta</span>
                            </span>
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
                        className={NAV_ITEM_CLASS}
                      >
                        <Link
                          href={item.url}
                          {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          <NavIcon item={item} tone={section.tone} />
                          <span>{item.title}</span>
                          {item.external && (
                            <>
                              <ArrowUpRight
                                className="ml-auto size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              <span className="sr-only">(otevře se v nové záložce)</span>
                            </>
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
        <SidebarFooter className="gap-2 p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="Zpětná vazba"
                isActive={pathname === "/zpetna-vazba"}
                className={cn(
                  "h-10 rounded-xl bg-primary/10 px-3 text-primary",
                  "hover:bg-primary/15 hover:text-primary",
                  "data-[active=true]:bg-primary/15 data-[active=true]:text-primary",
                )}
              >
                <Link href="/zpetna-vazba">
                  <MessageSquareHeart className="size-4" />
                  <span className="font-medium">Napiš nám zpětnou vazbu</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <NavUser user={user} />
        </SidebarFooter>
      )}
    </>
  )
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const { isMobile } = useSidebar()
  // Mobile gets the bottom navigation bar instead of the sidebar sheet.
  if (isMobile) return null
  return (
    // collapsible="none": the sidebar is permanent chrome — no toggle, no
    // rail, no keyboard shortcut can hide it. The `hidden md:flex` guard keeps
    // it display:none on mobile during SSR and the pre-hydration paint, before
    // `useIsMobile` flips to true and unmounts it, so it never flashes.
    <Sidebar collapsible="none" className="hidden border-r md:flex" {...props}>
      <AppSidebarContent user={user} />
    </Sidebar>
  )
}
