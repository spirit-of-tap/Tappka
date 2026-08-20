"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { House, LayoutGrid, User, Users } from "lucide-react"

import { NAV_MODULES } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { title: "Domů", url: "/", icon: House },
  { title: "Moduly", url: "/moduly", icon: LayoutGrid },
  { title: "Komunita", url: "/komunita", icon: Users },
  { title: "Profil", url: "/profil", icon: User },
] as const

// Module routes light up the Moduly tab (section highlighting); /komunita*
// belongs to the Komunita tab, so those urls are excluded here. Matching runs
// on the url's first path segment so every route of a module counts — e.g.
// Čtení is registered at /cteni/prehled but /cteni/hledat must highlight
// Moduly too.
const MODULE_SECTIONS = [
  ...new Set(
    NAV_MODULES
      .filter((m) => m.url !== "/" && !m.url.startsWith("/komunita"))
      .map((m) => m.url.split("/")[1]),
  ),
]

export function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (url: string) => {
    if (url === "/") return pathname === "/"
    if (url === "/moduly") {
      return (
        pathname === "/moduly" ||
        pathname.startsWith("/moduly/") ||
        MODULE_SECTIONS.some((s) => pathname === `/${s}` || pathname.startsWith(`/${s}/`))
      )
    }
    return pathname === url || pathname.startsWith(url + "/")
  }

  return (
    <nav aria-label="Hlavní navigace" className="fixed inset-x-0 bottom-0 z-50 md:hidden">
      <div className="flex h-16 items-stretch border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {TABS.map((tab) => {
          const active = isActive(tab.url)
          return (
            <Link
              key={tab.url}
              href={tab.url}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 transition-transform active:scale-[0.98]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <tab.icon className="size-5" aria-hidden />
              <span className="text-[11px] font-medium">{tab.title}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
