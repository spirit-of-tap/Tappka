import { YEAR_LABELS } from "@/lib/komunita/types"

import { TS_DISCOVER_FILTERS, TS_ROUTES, type TsDiscoverFilter } from "./constants"

export const DEFAULT_DISCOVER_FILTER: TsDiscoverFilter = "nadchazejici"

export const DISCOVER_SEARCH_PARAMS = {
  filter: "filtr",
  year: "rocnik",
  query: "q",
} as const

export function parseDiscoverFilter(value: string | undefined): TsDiscoverFilter {
  return (TS_DISCOVER_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as TsDiscoverFilter)
    : DEFAULT_DISCOVER_FILTER
}

export function parseDiscoverYear(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Object.hasOwn(YEAR_LABELS, n) ? n : null
}

export function buildDiscoverHref(params: {
  filter: TsDiscoverFilter
  year: number | null
  q: string
}): string {
  const search = new URLSearchParams()
  if (params.filter !== DEFAULT_DISCOVER_FILTER) search.set(DISCOVER_SEARCH_PARAMS.filter, params.filter)
  if (params.year !== null) search.set(DISCOVER_SEARCH_PARAMS.year, String(params.year))
  if (params.q) search.set(DISCOVER_SEARCH_PARAMS.query, params.q)
  const qs = search.toString()
  return qs ? `${TS_ROUTES.discover}?${qs}` : TS_ROUTES.discover
}
