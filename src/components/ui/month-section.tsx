"use client"

import { useState, type ReactNode } from "react"
import { Calendar, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface MonthSectionProps {
  label: string
  count: number
  defaultOpen?: boolean
  /** While searching: ignore collapsed state so matches are always shown. */
  forceOpen?: boolean
  children: ReactNode
}

export function MonthSection({
  label,
  count,
  defaultOpen = false,
  forceOpen = false,
  children,
}: MonthSectionProps) {
  const [collapsed, setCollapsed] = useState(!defaultOpen)
  const id = `month-${label.toLowerCase().replace(/\s+/g, "-")}`
  const open = forceOpen || !collapsed

  return (
    <section>
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="focus-ring group mb-2 flex w-full items-center gap-2 sm:mb-3"
        aria-expanded={open}
        aria-controls={id}
      >
        <Calendar className="size-4 shrink-0 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h2>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {count}
        </Badge>
        <ChevronDown
          aria-hidden
          className={`ml-auto size-4 text-muted-foreground transition-transform ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      <div id={id} className="space-y-2" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
