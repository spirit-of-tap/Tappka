import { RotateCcw } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { YEAR_LABELS } from "@/lib/komunita/types"
import {
  TS_DISCOVER_FILTER_LABELS,
  TS_DISCOVER_FILTERS,
  TS_ROUTES,
  type TsDiscoverFilter,
} from "@/lib/training-sessions/constants"
import { buildDiscoverHref, DEFAULT_DISCOVER_FILTER } from "@/lib/training-sessions/discover-params"
import { cn } from "@/lib/utils"

import { DiscoverSearch } from "./discover-search"

interface DiscoverFiltersProps {
  filter: TsDiscoverFilter
  year: number | null
  q: string
}

const CHIP_CLASS =
  "inline-flex items-center rounded-full border px-3 py-1 text-xs sm:text-sm font-medium transition-colors hover:bg-accent focus-ring"
const CHIP_INACTIVE_CLASS = "border-border/60 bg-card text-muted-foreground hover:text-foreground"
const CHIP_ACTIVE_CLASS = "border-primary bg-primary/10 text-primary hover:bg-primary/15"

export function DiscoverFilters({ filter, year, q }: DiscoverFiltersProps) {
  const hasActiveFilters = filter !== DEFAULT_DISCOVER_FILTER || year !== null || Boolean(q)

  return (
    <div className="space-y-3.5">
      <DiscoverSearch />

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {TS_DISCOVER_FILTERS.map((f) => (
            <Link
              key={f}
              href={buildDiscoverHref({ filter: f, year, q })}
              className={cn(CHIP_CLASS, f === filter ? CHIP_ACTIVE_CLASS : CHIP_INACTIVE_CLASS)}
              aria-current={f === filter ? "true" : undefined}
            >
              {TS_DISCOVER_FILTER_LABELS[f]}
            </Link>
          ))}

          <span aria-hidden className="hidden sm:inline-block mx-1 h-5 w-px bg-border/60" />

          {Object.entries(YEAR_LABELS).map(([value, label]) => {
            const n = Number(value)
            const active = year === n
            return (
              <Link
                key={value}
                href={buildDiscoverHref({ filter, year: active ? null : n, q })}
                className={cn(CHIP_CLASS, active ? CHIP_ACTIVE_CLASS : CHIP_INACTIVE_CLASS)}
                aria-current={active ? "true" : undefined}
              >
                {label}
              </Link>
            )
          })}
        </div>

        {hasActiveFilters && (
          <Button asChild variant="ghost" size="sm" className="h-7 self-start text-xs text-muted-foreground hover:text-foreground sm:self-center">
            <Link href={TS_ROUTES.discover}>
              <RotateCcw className="size-3 mr-1" aria-hidden />
              Resetovat filtry
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
