"use client"

import { Compass, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { TS_ROUTES } from "@/lib/training-sessions/constants"

const TABS = [
  { title: "Přehled", url: TS_ROUTES.overview, icon: User },
  { title: "Objevovat", url: TS_ROUTES.discover, icon: Compass },
] as const

const TS_ROUTE_PREFIX = `${TS_ROUTES.root}/`

export function getActiveTsTabUrl(pathname: string): string | undefined {
  if (pathname.startsWith(TS_ROUTES.overview) || pathname === TS_ROUTES.create) return TS_ROUTES.overview
  if (pathname.startsWith(TS_ROUTE_PREFIX)) return TS_ROUTES.discover
  return undefined
}

export function TsTabBar() {
  const activeUrl = getActiveTsTabUrl(usePathname())
  return (
    <nav
      aria-label="Tréninkové sessions"
      className="sticky top-0 z-40 -mx-4 border-b bg-background px-4 md:static md:z-auto md:mx-0 md:px-0"
    >
      <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto md:container md:mx-auto md:px-6">
        {TABS.map((tab) => (
          <Link
            key={tab.url}
            href={tab.url}
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
