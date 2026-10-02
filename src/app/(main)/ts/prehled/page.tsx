import Link from "next/link"
import { redirect } from "next/navigation"

import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { SessionAgenda } from "@/components/training-sessions/session-agenda"
import { SessionCard, type SessionViewer } from "@/components/training-sessions/session-card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { listSessions } from "@/lib/training-sessions/queries"
import { toTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"

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
        action={
          viewer.teamId ? (
            <Button asChild>
              <Link href={TS_ROUTES.create}>Nové TS</Link>
            </Button>
          ) : undefined
        }
      />
      <FeedRefresher />

      <div className="space-y-8">
        {facilitating.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">Facilituješ</h2>
            {facilitating.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning-strong"
              >
                <span>{s.topic}: příprava zatím chybí</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`${TS_ROUTES.detail(s.id)}?tab=priprava`}>Přidat přípravu</Link>
                </Button>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-heading text-lg font-semibold">Nejbližší TS</h2>
          {nearest ? (
            <SessionCard session={nearest} viewer={viewer} conflicts={[]} now={nowIso} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Nemáš naplánované žádné TS.{" "}
              <Link className="underline" href={TS_ROUTES.discover}>
                Podívej se do Objevovat
              </Link>
              .
            </p>
          )}
        </section>

        {rest.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">Nadcházející</h2>
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
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-semibold">Chybí reflexe</h2>
            <ul className="space-y-1 text-sm">
              {missingReflections.map((s) => (
                <li key={s.id}>
                  <Link className="underline" href={`${TS_ROUTES.detail(s.id)}?tab=reflexe`}>
                    {s.topic}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  )
}
