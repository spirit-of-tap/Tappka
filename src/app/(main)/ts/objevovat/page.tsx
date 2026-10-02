import Link from "next/link"
import { redirect } from "next/navigation"

import {
  DEFAULT_DISCOVER_FILTER,
  DiscoverFilters,
} from "@/components/training-sessions/discover-filters"
import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { SessionAgenda } from "@/components/training-sessions/session-agenda"
import type { SessionViewer } from "@/components/training-sessions/session-card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { YEAR_LABELS } from "@/lib/komunita/types"
import { createClient } from "@/lib/supabase/server"
import { TS_DISCOVER_FILTERS, TS_ROUTES, type TsDiscoverFilter } from "@/lib/training-sessions/constants"
import { listSessions, searchSessionIds } from "@/lib/training-sessions/queries"
import { toTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"

const PAGE_DESCRIPTION = "Tréninkové sessions všech týmů a volná místa, kam se můžeš přihlásit"

export const metadata = {
  title: "Objevovat TS",
  description: PAGE_DESCRIPTION,
}

interface PageProps {
  searchParams: Promise<{ filtr?: string; rocnik?: string; q?: string }>
}

const PAST_LIMIT = 100

function parseFilter(value: string | undefined): TsDiscoverFilter {
  return (TS_DISCOVER_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as TsDiscoverFilter)
    : DEFAULT_DISCOVER_FILTER
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
  const nowIso = new Date().toISOString()

  // Only search with a non-empty query — an empty one would match everything.
  const ids = q ? await searchSessionIds(supabase, q) : undefined
  const isPast = filter === "probehle"
  const noSearchHits = ids !== undefined && ids.length === 0
  const sessions = noSearchHits
    ? []
    : await listSessions(supabase, {
        ...(isPast ? { to: nowIso, order: "desc" as const, limit: PAST_LIMIT } : { from: nowIso }),
        ids,
      })

  const viewer: SessionViewer = { profileId: profile.id, teamId: profile.team_id }
  const filtered = sessions.filter(
    (s) => applyFilter(s, filter, viewer) && (year === null || s.team?.onboardingYear === year),
  )

  // Overlap warnings compare against the viewer's upcoming program (own team + joined TS).
  const upcoming = isPast || ids !== undefined ? await listSessions(supabase, { from: nowIso }) : sessions
  const commitments = upcoming
    .filter((s) => s.team_id === viewer.teamId || s.guests.some((g) => g.profile_id === viewer.profileId))
    .map(toTiming)

  return (
    <PageShell size="medium">
      <PageHeader
        title="Objevovat"
        description={PAGE_DESCRIPTION}
        action={
          profile.team_id ? (
            <Button asChild>
              <Link href={TS_ROUTES.create}>Nové TS</Link>
            </Button>
          ) : undefined
        }
      />
      <FeedRefresher />
      <DiscoverFilters filter={filter} year={year} q={q} />
      <SessionAgenda
        sessions={filtered}
        viewer={viewer}
        commitments={commitments}
        now={nowIso}
        emptyTitle="Žádné TS"
        emptyDescription={q ? "Zkus jiný výraz nebo jiný filtr." : "Pro tento filtr teď nic není."}
      />
    </PageShell>
  )
}

function applyFilter(s: TrainingSessionListItem, filter: TsDiscoverFilter, viewer: SessionViewer): boolean {
  switch (filter) {
    case "volna-mista":
      return !s.cancelled_at && s.team_id !== viewer.teamId && s.guests.length < s.guest_capacity
    case "muj-tym":
      return s.team_id === viewer.teamId
    case "prihlasene":
      return s.guests.some((g) => g.profile_id === viewer.profileId)
    default:
      return true
  }
}
