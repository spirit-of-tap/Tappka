import { RotateCcw, Search, X } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { YEAR_LABELS } from "@/lib/komunita/types"
import {
  TS_DISCOVER_FILTER_LABELS,
  TS_DISCOVER_FILTERS,
  TS_ROUTES,
  type TsDiscoverFilter,
} from "@/lib/training-sessions/constants"
import { cn } from "@/lib/utils"

export const DEFAULT_DISCOVER_FILTER: TsDiscoverFilter = "nadchazejici"

export const DISCOVER_SEARCH_PARAMS = {
  filter: "filtr",
  year: "rocnik",
  query: "q",
} as const

interface DiscoverFiltersProps {
  filter: TsDiscoverFilter
  year: number | null
  q: string
}

function buildDiscoverHref(params: { filter: TsDiscoverFilter; year: number | null; q: string }): string {
  const search = new URLSearchParams()
  if (params.filter !== DEFAULT_DISCOVER_FILTER) search.set(DISCOVER_SEARCH_PARAMS.filter, params.filter)
  if (params.year !== null) search.set(DISCOVER_SEARCH_PARAMS.year, String(params.year))
  if (params.q) search.set(DISCOVER_SEARCH_PARAMS.query, params.q)
  const qs = search.toString()
  return qs ? `${TS_ROUTES.discover}?${qs}` : TS_ROUTES.discover
}

const CHIP_CLASS =
  "inline-flex items-center rounded-full border px-3 py-1 text-xs sm:text-sm font-medium transition-colors hover:bg-accent focus-ring"
const CHIP_INACTIVE_CLASS = "border-border/60 bg-card text-muted-foreground hover:text-foreground"
const CHIP_ACTIVE_CLASS = "border-primary bg-primary/10 text-primary hover:bg-primary/15"

export function DiscoverFilters({ filter, year, q }: DiscoverFiltersProps) {
  const hasActiveFilters = filter !== DEFAULT_DISCOVER_FILTER || year !== null || Boolean(q)

  return (
    <div className="space-y-3.5">
      <form action={TS_ROUTES.discover} className="flex items-center gap-2" role="search">
        {filter !== DEFAULT_DISCOVER_FILTER && (
          <input type="hidden" name={DISCOVER_SEARCH_PARAMS.filter} value={filter} />
        )}
        {year !== null && <input type="hidden" name={DISCOVER_SEARCH_PARAMS.year} value={year} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            name={DISCOVER_SEARCH_PARAMS.query}
            defaultValue={q}
            placeholder="Hledat podle tématu nebo přípravy…"
            className="pl-9 pr-8"
            aria-label="Hledat TS"
          />
          {q && (
            <Link
              href={buildDiscoverHref({ filter, year, q: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground focus-ring"
              aria-label="Vymazat hledání"
            >
              <X className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
        <Button type="submit" variant="outline">
          Hledat
        </Button>
      </form>

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
