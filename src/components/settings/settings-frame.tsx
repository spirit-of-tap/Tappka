"use client"

import { Bell, Building2, CalendarSync, ChevronLeft, ChevronRight, Tags, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

import { activeSettingsSection, SETTINGS_ROUTES, type SettingsSection, type SettingsSectionId } from "@/lib/settings/sections"
import { cn } from "@/lib/utils"

const SECTION_ICONS: Record<SettingsSectionId, LucideIcon> = {
  notifikace: Bell,
  cas: Tags,
  ts: CalendarSync,
  mistnosti: Building2,
}

interface SettingsFrameProps {
  sections: SettingsSection[]
  children: ReactNode
}

/**
 * Nastavení layout: section list beside the content on desktop. On phones the hub
 * shows only the list and a section shows only its content with a way back.
 */
export function SettingsFrame({ sections, children }: SettingsFrameProps) {
  const active = activeSettingsSection(usePathname())

  return (
    <div className="grid gap-6 md:grid-cols-[14rem_1fr] md:items-start">
      <nav aria-label="Nastavení" className={cn("space-y-3 md:sticky md:top-6", active && "hidden md:block")}>
        <h1 className="font-heading text-2xl font-semibold md:text-lg">Nastavení</h1>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card md:divide-y-0 md:border-0 md:bg-transparent">
          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.id]
            const isActive = section.id === active
            return (
              <li key={section.id}>
                <Link
                  href={section.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent focus-ring md:rounded-md md:px-3 md:py-2",
                    isActive && "bg-accent font-medium text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block">{section.title}</span>
                    <span className="block text-xs text-muted-foreground md:hidden">{section.description}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground md:hidden" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={cn("min-w-0", !active && "hidden md:block")}>
        {active && (
          <Link
            href={SETTINGS_ROUTES.root}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-ring md:hidden"
          >
            <ChevronLeft className="size-4" aria-hidden />
            <span className="sr-only">Zpět na nastavení</span>
            <span aria-hidden>Nastavení</span>
          </Link>
        )}
        {children}
      </div>
    </div>
  )
}
