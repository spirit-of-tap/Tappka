"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TS_DETAIL_TABS, type TsDetailTab } from "@/lib/training-sessions/constants"

const TAB_QUERY_PARAM = "tab"

const TAB_LABELS: Record<TsDetailTab, string> = {
  priprava: "Příprava",
  dochazka: "Docházka",
  reflexe: "Reflexe",
}

export type SessionDetailPanels = Partial<Record<TsDetailTab, ReactNode>>

interface SessionDetailTabsProps {
  panels: SessionDetailPanels
}

function isTsDetailTab(value: string | null): value is TsDetailTab {
  return (TS_DETAIL_TABS as readonly string[]).includes(value ?? "")
}

export function SessionDetailTabs({ panels }: SessionDetailTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const available = TS_DETAIL_TABS.filter((t) => panels[t] !== undefined)
  const requested = searchParams.get(TAB_QUERY_PARAM)
  const active = isTsDetailTab(requested) && available.includes(requested) ? requested : available[0]

  function onValueChange(tab: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.set(TAB_QUERY_PARAM, tab)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={active} onValueChange={onValueChange}>
      <TabsList>
        {available.map((t) => (
          <TabsTrigger key={t} value={t}>
            {TAB_LABELS[t]}
          </TabsTrigger>
        ))}
      </TabsList>
      {available.map((t) => (
        <TabsContent key={t} value={t} className="mt-4">
          {panels[t]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
