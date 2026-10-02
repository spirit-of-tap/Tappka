import { CalendarDays, FileEdit, MessageSquareText, Plus, Sparkles } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { SessionAgenda } from "@/components/training-sessions/session-agenda"
import { SessionCard, type SessionViewer } from "@/components/training-sessions/session-card"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatDayHeading, formatTimeRange } from "@/lib/training-sessions/format"
import { listSessions } from "@/lib/training-sessions/queries"
import { toTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

const PAGE_DESCRIPTION = "Tvoje nadcházející TS, příprava a TS, na které se chystáš"

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

  const upcoming = await listSessions(supabase, { from: nowIso })
  const mine = upcoming.filter(
    (s) =>
      !s.cancelled_at &&
      ((viewer.teamId !== null && s.team_id === viewer.teamId) || s.guests.some((g) => g.profile_id === viewer.profileId)),
  )
  const [nearest, ...rest] = mine
  const facilitating = mine.filter(
    (s) =>
      viewer.teamId !== null &&
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

  const commitments = mine.map(toTiming)

  return (
    <PageShell size="medium">
      <PageHeader
        title="Tréninkové sessions"
        description={PAGE_DESCRIPTION}
        count={mine.length > 0 ? { value: mine.length, label: pluralizeCz(mine.length, ["setkání", "setkání", "setkání"]) } : undefined}
        action={
          viewer.teamId ? (
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

      <div className="space-y-8">
        {facilitating.length > 0 && (
          <section aria-label="Upozornění na facilitaci" className="space-y-2.5">
            <h2 className="font-heading text-lg font-semibold text-warning-strong flex items-center gap-2">
              <FileEdit className="size-5 shrink-0" aria-hidden />
              <span>Čeká tě facilitace</span>
            </h2>
            <div className="space-y-2">
              {facilitating.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning-strong"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground">{s.topic}</p>
                    <p className="text-xs text-warning-strong">
                      {formatDayHeading(s.starts_at)} · {formatTimeRange(s.starts_at, s.ends_at)} · příprava zatím chybí
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="border-warning/40 hover:bg-warning/20 shrink-0 self-start sm:self-center">
                    <Link href={`${TS_ROUTES.detail(s.id)}?tab=priprava`}>Přidat přípravu</Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <span>Nejbližší TS</span>
          </h2>
          {nearest ? (
            <SessionCard session={nearest} viewer={viewer} conflicts={[]} now={nowIso} showDate />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
                </EmptyMedia>
                <EmptyTitle>Nemáš naplánované žádné TS</EmptyTitle>
                <EmptyDescription>Podívej se na nabídku ostatních týmů nebo naplánuj nové TS pro svůj tým.</EmptyDescription>
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

        {rest.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Další naplánovaná TS</h2>
            <SessionAgenda
              sessions={rest}
              viewer={viewer}
              commitments={commitments}
              now={nowIso}
              emptyTitle="Žádné další TS"
              emptyDescription="Nic dalšího teď není naplánováno."
            />
          </section>
        )}

        {missingReflections.length > 0 && (
          <section aria-label="Chybějící reflexe" className="space-y-3">
            <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
              <MessageSquareText className="size-4 text-warning-strong" aria-hidden />
              <span>Chybí týmová reflexe</span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {missingReflections.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-card p-3.5 shadow-xs"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{formatDayHeading(s.starts_at)}</p>
                    <p className="font-heading text-sm font-semibold truncate text-foreground">{s.topic}</p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0 border-warning/40 hover:bg-warning/10">
                    <Link href={`${TS_ROUTES.detail(s.id)}?tab=reflexe`}>
                      Napsat reflexi
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  )
}

