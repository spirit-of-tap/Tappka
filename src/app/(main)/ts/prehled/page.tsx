import { CalendarDays, FileEdit, MessageSquareText, Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { SessionAgenda } from "@/components/training-sessions/session-agenda"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_HISTORY_LIMIT, TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatDayHeading, formatTimeRange } from "@/lib/training-sessions/format"
import { listSessions, listViewerSessions } from "@/lib/training-sessions/queries"
import { toTiming, type SessionViewer, type TrainingSessionListItem } from "@/lib/training-sessions/types"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

const PAGE_DESCRIPTION = "TS, na která jdeš, a ta, která už proběhla"

export const metadata = {
  title: "Tréninkové sessions",
  description: PAGE_DESCRIPTION,
}

const REFLECTION_LOOKBACK_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export default async function TsOverviewPage() {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const supabase = await createClient()
  const now = new Date()
  const nowIso = now.toISOString()
  const viewer: SessionViewer = { profileId: profile.id, teamId: profile.team_id }

  const [upcomingAll, pastAll] = await Promise.all([
    listViewerSessions(supabase, viewer, { from: nowIso }),
    listViewerSessions(supabase, viewer, { to: nowIso, order: "desc", limit: TS_HISTORY_LIMIT }),
  ])
  const upcoming = upcomingAll.filter((s) => !s.cancelled_at)
  const history = pastAll.filter((s) => !s.cancelled_at)
  const facilitating = upcoming.filter(
    (s) =>
      s.team_id === viewer.teamId &&
      !s.preparation?.published_at &&
      s.facilitators.some((f) => f.profile?.id === viewer.profileId),
  )

  let missingReflections: TrainingSessionListItem[] = []
  if (viewer.teamId) {
    const recent = await listSessions(supabase, {
      teamId: viewer.teamId,
      from: new Date(now.getTime() - REFLECTION_LOOKBACK_DAYS * MS_PER_DAY).toISOString(),
      to: nowIso,
      order: "desc",
    })
    if (recent.length > 0) {
      const { data: reflections } = await supabase
        .from("training_session_reflections")
        .select("training_session_id")
        .in(
          "training_session_id",
          recent.map((s) => s.id),
        )
      const withReflection = new Set((reflections ?? []).map((r) => r.training_session_id))
      missingReflections = recent.filter((s) => !s.cancelled_at && !withReflection.has(s.id))
    }
  }

  return (
    <PageShell size="medium">
      <PageHeader
        title="Tréninkové sessions"
        description={PAGE_DESCRIPTION}
        count={
          upcoming.length > 0
            ? { value: upcoming.length, label: pluralizeCz(upcoming.length, ["nadcházející", "nadcházející", "nadcházejících"]) }
            : undefined
        }
        action={
          viewer.teamId ? (
            <Button asChild>
              <Link href={TS_ROUTES.create}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                Nové TS
              </Link>
            </Button>
          ) : undefined
        }
      />
      <FeedRefresher />

      <div className="space-y-10">
        {facilitating.length > 0 && (
          <section aria-labelledby="ts-facilitating" className="space-y-2.5">
            <h2 id="ts-facilitating" className="flex items-center gap-2 font-heading text-lg font-semibold text-warning-strong">
              <FileEdit className="size-5 shrink-0" aria-hidden />
              <span>Čeká tě facilitace</span>
            </h2>
            <ul className="space-y-2">
              {facilitating.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col justify-between gap-3 rounded-xl bg-warning/10 p-4 text-sm sm:flex-row sm:items-center"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">{s.topic}</p>
                    <p className="text-xs text-warning-strong">
                      {formatDayHeading(s.starts_at)} · {formatTimeRange(s.starts_at, s.ends_at)} · příprava zatím chybí
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0 self-start sm:self-center">
                    <Link href={`${TS_ROUTES.detail(s.id)}?tab=priprava`}>Napsat přípravu</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="ts-upcoming" className="space-y-3">
          <h2 id="ts-upcoming" className="font-heading text-lg font-semibold">
            Nadcházející
          </h2>
          {upcoming.length > 0 ? (
            <SessionAgenda
              sessions={upcoming}
              viewer={viewer}
              commitments={upcoming.map(toTiming)}
              now={nowIso}
              emptyTitle="Nemáš naplánované žádné TS"
              emptyDescription=""
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Nemáš naplánované žádné TS</EmptyTitle>
                <EmptyDescription>Podívej se, co chystají ostatní týmy, nebo naplánuj nové TS pro svůj tým.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button asChild variant="outline">
                    <Link href={TS_ROUTES.discover}>Objevovat TS</Link>
                  </Button>
                  {viewer.teamId && (
                    <Button asChild>
                      <Link href={TS_ROUTES.create}>Nové TS</Link>
                    </Button>
                  )}
                </div>
              </EmptyContent>
            </Empty>
          )}
        </section>

        {missingReflections.length > 0 && (
          <section aria-labelledby="ts-reflections" className="space-y-3">
            <h2 id="ts-reflections" className="flex items-center gap-2 font-heading text-lg font-semibold">
              <MessageSquareText className="size-4 text-warning-strong" aria-hidden />
              <span>Chybí týmová reflexe</span>
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {missingReflections.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3.5 shadow-xs"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{formatDayHeading(s.starts_at)}</p>
                    <p className="truncate font-heading text-sm font-semibold text-foreground">{s.topic}</p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href={`${TS_ROUTES.detail(s.id)}?tab=reflexe`}>Napsat reflexi</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="ts-history" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="ts-history" className="font-heading text-lg font-semibold">
              Historie
            </h2>
            {history.length >= TS_HISTORY_LIMIT && (
              <Link
                href={`${TS_ROUTES.discover}?filtr=probehle`}
                className="rounded-sm text-sm font-medium text-primary hover:underline focus-ring"
              >
                Všechna proběhlá TS
              </Link>
            )}
          </div>
          <SessionAgenda
            sessions={history}
            viewer={viewer}
            commitments={[]}
            now={nowIso}
            emptyTitle="Zatím žádná historie"
            emptyDescription="Tady uvidíš TS svého týmu a ta, kam se připojíš jako cross, jakmile proběhnou."
          />
        </section>
      </div>
    </PageShell>
  )
}
