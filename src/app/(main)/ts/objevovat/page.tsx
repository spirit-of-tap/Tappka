import { Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { DiscoverFeed } from "@/components/training-sessions/discover-feed"
import { DiscoverFilters } from "@/components/training-sessions/discover-filters"
import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { listDiscoverPage } from "@/lib/training-sessions/discover"
import { parseDiscoverFilter, parseDiscoverYear } from "@/lib/training-sessions/discover-params"
import { listViewerSessions } from "@/lib/training-sessions/queries"
import { toTiming, type SessionViewer } from "@/lib/training-sessions/types"

const PAGE_DESCRIPTION = "Co chystají všechny týmy a kam se můžeš přidat jako cross"

export const metadata = {
  title: "Objevovat TS",
  description: PAGE_DESCRIPTION,
}

interface PageProps {
  searchParams: Promise<{ filtr?: string; rocnik?: string; q?: string }>
}

export default async function TsDiscoverPage({ searchParams }: PageProps) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const supabase = await createClient()
  const params = await searchParams
  const filter = parseDiscoverFilter(params.filtr)
  const year = parseDiscoverYear(params.rocnik)
  const q = (params.q ?? "").trim()
  const now = new Date()
  const nowIso = now.toISOString()
  const viewer: SessionViewer = { profileId: profile.id, teamId: profile.team_id }

  const [page, viewerUpcoming] = await Promise.all([
    listDiscoverPage(supabase, viewer, { filter, year, q }, { now: nowIso }),
    // Overlap warnings compare against the viewer's upcoming program (own team + joined TS).
    filter === "probehle" ? [] : listViewerSessions(supabase, viewer, { from: nowIso }),
  ])
  const commitments = viewerUpcoming.map(toTiming)

  return (
    <PageShell size="medium">
      <PageHeader
        title="Objevovat"
        description={PAGE_DESCRIPTION}
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
        <DiscoverFeed
          key={`${filter}|${year ?? ""}|${q}`}
          initialSessions={page.sessions}
          nextOffset={page.nextOffset}
          query={{ filter, year, q }}
          viewer={viewer}
          commitments={commitments}
          now={nowIso}
          emptyTitle="Žádné TS"
          emptyDescription={q ? "Zkus jiný výraz nebo jiný filtr." : "V tomto období nic není."}
        />
      </div>
    </PageShell>
  )
}
