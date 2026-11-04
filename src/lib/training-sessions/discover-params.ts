import { TS_DISCOVER_HORIZON, TS_ROUTES, type TsDiscoverFilter } from "./constants"

export const DEFAULT_DISCOVER_FILTER: TsDiscoverFilter = "nadchazejici"

export const DISCOVER_SEARCH_PARAMS = {
  filter: "filtr",
  year: "rocnik",
  query: "q",
  windows: "mesicu",
} as const

export function buildDiscoverHref(params: {
  filter: TsDiscoverFilter
  year: number | null
  q: string
  windows?: number
}): string {
  const search = new URLSearchParams()
  if (params.filter !== DEFAULT_DISCOVER_FILTER) search.set(DISCOVER_SEARCH_PARAMS.filter, params.filter)
  if (params.year !== null) search.set(DISCOVER_SEARCH_PARAMS.year, String(params.year))
  if (params.q) search.set(DISCOVER_SEARCH_PARAMS.query, params.q)
  if (params.windows !== undefined && params.windows !== TS_DISCOVER_HORIZON.defaultWindows) {
    search.set(DISCOVER_SEARCH_PARAMS.windows, String(params.windows))
  }
  const qs = search.toString()
  return qs ? `${TS_ROUTES.discover}?${qs}` : TS_ROUTES.discover
}
