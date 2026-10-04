import { ChevronDown, Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import {
  buildDiscoverHref,
  DEFAULT_DISCOVER_FILTER,
  DiscoverFilters,
} from "@/components/training-sessions/discover-filters"
import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { SessionAgenda } from "@/components/training-sessions/session-agenda"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { YEAR_LABELS } from "@/lib/komunita/types"
import { createClient } from "@/lib/supabase/server"
import {
  TS_DISCOVER_FILTERS,
  PRAGUE_TIME_ZONE,
  TS_DISCOVER_HORIZON,
  TS_ROUTES,
  type TsDiscoverFilter,
} from "@/lib/training-sessions/constants"
import { listSessions, listViewerSessions, searchSessionIds } from "@/lib/training-sessions/queries"
import { toTiming, type SessionViewer, type TrainingSessionListItem } from "@/lib/training-sessions/types"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

const PAGE_DESCRIPTION = "Co chystají všechny týmy a kam se můžeš přidat jako cross"

export const metadata = {
  title: "Objevovat TS",
  description: PAGE_DESCRIPTION,
}

interface PageProps {
  searchParams: Promise<{ filtr?: string; rocnik?: string; q?: string; mesicu?: string }>
}

const PAST_LIMIT = 100
const MS_PER_DAY = 24 * 60 * 60 * 1000
const HORIZON_DATE_FORMAT = new Intl.DateTimeFormat("cs-CZ", { timeZone: PRAGUE_TIME_ZONE, day: "numeric", month: "long" })

function parseFilter(value: string | undefined): TsDiscoverFilter {
  return (TS_DISCOVER_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as TsDiscoverFilter)
    : DEFAULT_DISCOVER_FILTER
}

function parseWindows(value: string | undefined): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= TS_DISCOVER_HORIZON.maxWindows ? n : TS_DISCOVER_HORIZON.defaultWindows
}

function parseYear(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  return Object.hasOwn(YEAR_LABELS, n) ? n : null
}

export default async function TsDiscoverPage({ searchParams }: PageProps) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const supabase = await createClient()
  const params = await searchParams
  const filter = parseFilter(params.filtr)
  const year = parseYear(params.rocnik)
  const q = (params.q ?? "").trim()
  const windows = parseWindows(params.mesicu)
  const now = new Date()
  const nowIso = now.toISOString()

  // Only search with a non-empty query — an empty one would match everything.
  const ids = q ? await searchSessionIds(supabase, q) : undefined
  const isPast = filter === "probehle"
  // A search looks through everything upcoming; browsing looks a limited number of days ahead.
  const horizonEnd = isPast || q ? undefined : new Date(now.getTime() + windows * TS_DISCOVER_HORIZON.windowDays * MS_PER_DAY)
  const noSearchHits = ids !== undefined && ids.length === 0
  const viewer: SessionViewer = { profileId: profile.id, teamId: profile.team_id }
  const [sessions, viewerUpcoming] = await Promise.all([
    noSearchHits
      ? []
      : listSessions(supabase, {
          ...(isPast
            ? { to: nowIso, order: "desc" as const, limit: PAST_LIMIT }
            : { from: nowIso, to: horizonEnd?.toISOString() }),
          ids,
        }),
    // Overlap warnings compare against the viewer's upcoming program (own team + joined TS).
    isPast ? [] : listViewerSessions(supabase, viewer, { from: nowIso }),
  ])

  const filtered = sessions.filter(
    (s) => applyFilter(s, filter, viewer) && (year === null || s.team?.onboardingYear === year),
  )
  const commitments = viewerUpcoming.map(toTiming)
  const canLoadMore = horizonEnd !== undefined && windows < TS_DISCOVER_HORIZON.maxWindows

  return (
    <PageShell size="medium">
      <PageHeader
        title="Objevovat"
        description={PAGE_DESCRIPTION}
        count={filtered.length > 0 ? { value: filtered.length, label: pluralizeCz(filtered.length, ["setkání", "setkání", "setkání"]) } : undefined}
        action={
          profile.team_id ? (
            <Button asChild>
              <Link href={TS_ROUTES.create}>
                <Plus className="size-4 mr-1.5" aria-hidden />
                Nové TS
              </Link>
            </Button>
          ) : undefined
        }
      />
      <FeedRefresher />
      <div className="space-y-6">
        <DiscoverFilters filter={filter} year={year} q={q} />
        {horizonEnd && (
          <p className="text-sm text-muted-foreground">
            Zobrazuji TS do {HORIZON_DATE_FORMAT.format(horizonEnd)}.
          </p>
        )}
        <SessionAgenda
          sessions={filtered}
          viewer={viewer}
          commitments={commitments}
          now={nowIso}
          showLocation={false}
          emptyTitle="Žádné TS"
          emptyDescription={q ? "Zkus jiný výraz nebo jiný filtr." : "V tomto období nic není. Zkus se podívat dál dopředu."}
        />
        {canLoadMore && (
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href={buildDiscoverHref({ filter, year, q, windows: windows + 1 })} scroll={false}>
                <ChevronDown className="mr-1.5 size-4" aria-hidden />
                Načíst další měsíc
              </Link>
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  )
}

function applyFilter(s: TrainingSessionListItem, filter: TsDiscoverFilter, viewer: SessionViewer): boolean {
  switch (filter) {
    case "volna-mista":
      return !s.cancelled_at && s.team_id !== viewer.teamId && s.guests.length < s.guest_capacity
    default:
      return true
  }
}
