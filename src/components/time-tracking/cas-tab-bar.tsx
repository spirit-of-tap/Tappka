"use client"

import { CalendarDays, ChartColumn, User, Users, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { FROM_PARAM, TEAM_PARAM, TO_PARAM } from "./cas-query"

interface CasTab {
  title: string
  url: string
  icon: LucideIcon
}

const CAS_TABS: readonly CasTab[] = [
  { title: "Moje", url: "/cas", icon: User },
  { title: "Kalendář", url: "/cas/kalendar", icon: CalendarDays },
  { title: "Tým", url: "/cas/tym", icon: Users },
  { title: "Reporting", url: "/cas/reporting", icon: ChartColumn },
]

const MY_TAB_URL = "/cas"
/** Tabs about a team; a coach's `?team=` choice carries over between them. */
const TEAM_TAB_URLS: readonly string[] = ["/cas/tym", "/cas/reporting"]

export function getActiveCasTabUrl(pathname: string): string | undefined {
  const subTab = CAS_TABS.find(
    (tab) => tab.url !== MY_TAB_URL && (pathname === tab.url || pathname.startsWith(`${tab.url}/`)),
  )
  if (subTab) return subTab.url
  if (pathname === MY_TAB_URL || pathname.startsWith(`${MY_TAB_URL}/`)) return MY_TAB_URL
  return undefined
}

/** Tab URL carrying over the period (and a coach's team), so switching tabs keeps them. */
export function casTabHref(url: string, searchParams: URLSearchParams): string {
  const params = new URLSearchParams()
  const keys = TEAM_TAB_URLS.includes(url) ? [FROM_PARAM, TO_PARAM, TEAM_PARAM] : [FROM_PARAM, TO_PARAM]
  for (const key of keys) {
    const value = searchParams.get(key)
    if (value !== null) params.set(key, value)
  }
  const query = params.toString()
  return query ? `${url}?${query}` : url
}

/**
 * URL-driven sub-navigation for every /cas/* route — same visual language as
 * `CteniTabBar` (pinned full-bleed strip on phones, static on md+).
 */
export function CasTabBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeUrl = getActiveCasTabUrl(pathname)

  return (
    <nav
      aria-label="Čas"
      className="sticky top-0 z-40 -mx-4 border-b bg-background px-4 md:static md:z-auto md:mx-0 md:px-0"
    >
      <div className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar md:container md:mx-auto md:px-6">
        {CAS_TABS.map((tab) => (
          <Link
            key={tab.url}
            href={casTabHref(tab.url, searchParams)}
            aria-current={activeUrl === tab.url ? "page" : undefined}
            data-active={activeUrl === tab.url ? "true" : undefined}
            className={[
              "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none",
              "px-3 py-3.5 text-sm font-medium transition-colors focus-ring",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full",
              "after:bg-primary after:opacity-0 after:transition-opacity",
              "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
              "data-[active=true]:text-foreground data-[active=true]:after:opacity-100",
            ].join(" ")}
          >
            <tab.icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{tab.title}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
