"use client"

import { usePathname } from "next/navigation"

// Titles share the sidebar/bottom-nav naming. Longest matching url wins.
const PAGE_TITLES: ReadonlyArray<{ url: string; title: string }> = [
  { url: "/", title: "Domů" },
  { url: "/moduly", title: "Moduly" },
  { url: "/profil", title: "Profil" },
  { url: "/reservations", title: "Místnosti" },
  { url: "/komunita", title: "Komunita" },
  { url: "/schuzky", title: "Zák. schůzky" },
  { url: "/koucovani", title: "Koučování" },
  { url: "/tymova-reflexe", title: "Týmová reflexe" },
  { url: "/tymovy-denik", title: "Týmový deník" },
  { url: "/nastroje-techniky", title: "Nástroje a techniky" },
  { url: "/cteni", title: "Čtení" },
  { url: "/birth-giving", title: "Birth Giving" },
  { url: "/zpetna-vazba", title: "Zpětná vazba" },
  { url: "/settings", title: "Nastavení" },
  { url: "/portfolio", title: "Portfolio" },
  { url: "/beta", title: "Beta přístup" },
]

export function pageTitleFor(pathname: string): string | null {
  let best: { url: string; title: string } | null = null
  for (const entry of PAGE_TITLES) {
    const matches =
      entry.url === "/"
        ? pathname === "/"
        : pathname === entry.url || pathname.startsWith(entry.url + "/")
    if (matches && (!best || entry.url.length > best.url.length)) best = entry
  }
  return best ? best.title : null
}

export function MobilePageTitle() {
  const pathname = usePathname()
  const title = pageTitleFor(pathname)
  if (!title) return null
  return <span className="text-sm font-semibold md:hidden">{title}</span>
}