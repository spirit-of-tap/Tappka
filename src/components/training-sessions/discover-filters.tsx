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

const CHIP_CLASS = "rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent focus-ring"
// No `primary-strong` token exists; --primary is text-safe on its own /10 tint (repo convention).
const CHIP_ACTIVE_CLASS = "border-primary bg-primary/10 text-primary hover:bg-primary/15"

export function DiscoverFilters({ filter, year, q }: DiscoverFiltersProps) {
  return (
    <div className="space-y-3">
      <form action={TS_ROUTES.discover} className="flex gap-2" role="search">
        {filter !== DEFAULT_DISCOVER_FILTER && (
          <input type="hidden" name={DISCOVER_SEARCH_PARAMS.filter} value={filter} />
        )}
        {year !== null && <input type="hidden" name={DISCOVER_SEARCH_PARAMS.year} value={year} />}
        <Input
          type="search"
          name={DISCOVER_SEARCH_PARAMS.query}
          defaultValue={q}
          placeholder="Hledat podle tématu nebo přípravy…"
          aria-label="Hledat TS"
        />
        <Button type="submit" variant="outline">
          Hledat
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        {TS_DISCOVER_FILTERS.map((f) => (
          <Link
            key={f}
            href={buildDiscoverHref({ filter: f, year, q })}
            className={cn(CHIP_CLASS, f === filter && CHIP_ACTIVE_CLASS)}
            aria-current={f === filter ? "true" : undefined}
          >
            {TS_DISCOVER_FILTER_LABELS[f]}
          </Link>
        ))}
        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
        {Object.entries(YEAR_LABELS).map(([value, label]) => {
          const n = Number(value)
          const active = year === n
          return (
            <Link
              key={value}
              href={buildDiscoverHref({ filter, year: active ? null : n, q })}
              className={cn(CHIP_CLASS, active && CHIP_ACTIVE_CLASS)}
              aria-current={active ? "true" : undefined}
            >
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
