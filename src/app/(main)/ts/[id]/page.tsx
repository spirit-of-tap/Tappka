import { CircleAlert, Lock } from "lucide-react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { cache, Suspense, type ReactNode } from "react"

import { ProfileAvatar } from "@/components/profile-avatar"
import { AttendancePanel } from "@/components/training-sessions/attendance-panel"
import { CopyPreparationButton } from "@/components/training-sessions/copy-preparation-button"
import { FeedRefresher } from "@/components/training-sessions/feed-refresher"
import { GuestJoinButton } from "@/components/training-sessions/guest-join-button"
import { PreparationPanel } from "@/components/training-sessions/preparation-panel"
import { ReflectionPanel } from "@/components/training-sessions/reflection-panel"
import { SessionActionsMenu } from "@/components/training-sessions/session-actions-menu"
import { SessionDetailTabs, type SessionDetailPanels } from "@/components/training-sessions/session-detail-tabs"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { PageShell } from "@/components/ui/page-shell"
import { getSessionProfile } from "@/lib/auth/session"
import { contentTextFromJson } from "@/lib/essays/content-text"
import { createClient } from "@/lib/supabase/server"
import { findConflicts } from "@/lib/training-sessions/conflicts"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatDayHeading, formatTimeRange, teamAccentStyles } from "@/lib/training-sessions/format"
import { getReflection, getSessionDetail, listAttendance, listViewerSessions } from "@/lib/training-sessions/queries"
import { getSessionStatus } from "@/lib/training-sessions/status"
import { toTiming, type TrainingSessionDetail, type TsPersonSummary } from "@/lib/training-sessions/types"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import { cn } from "@/lib/utils"

const FALLBACK_METADATA: Metadata = {
  title: "Detail TS",
  description: "Téma, příprava, docházka a týmová reflexe tréninkové session",
}

const GUEST_ROLE = "student"
const UNNAMED_PERSON = "Bez jména"
const PERSON_CHIP_CLASS = "inline-flex h-8 items-center gap-2 rounded-full bg-muted/60 pl-1 pr-3 text-sm text-foreground"

interface PageProps {
  params: Promise<{ id: string }>
}

// Shared by generateMetadata and the page so the session is fetched once per request.
const loadSession = cache(async (id: string): Promise<TrainingSessionDetail | null> => {
  const supabase = await createClient()
  return getSessionDetail(supabase, id)
})

function buildHeaderDescription(session: TrainingSessionDetail): string {
  return [session.team?.name, formatDayHeading(session.starts_at), formatTimeRange(session.starts_at, session.ends_at)]
    .filter(Boolean)
    .join(" · ")
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const session = await loadSession(id).catch(() => null)
  if (!session) return FALLBACK_METADATA
  return { title: session.topic, description: buildHeaderDescription(session) }
}

export default async function TsDetailPage({ params }: PageProps) {
  const profile = await getSessionProfile()
  if (!profile) redirect("/auth/login")
  const { id } = await params
  const session = await loadSession(id)
  if (!session) notFound()
  const supabase = await createClient()

  const now = new Date()
  const status = getSessionStatus(toTiming(session), now)
  const viewer = { profileId: profile.id, teamId: profile.team_id }
  const isOwnTeam = viewer.teamId !== null && viewer.teamId === session.team_id
  const joined = session.guests.some((g) => g.profile_id === profile.id)
  const isFull = session.guests.length >= session.guest_capacity
  const location = session.room?.code ?? session.location_note
  const canJoin = !isOwnTeam && status === "upcoming" && session.guest_capacity > 0 && !joined && !isFull
  const canLeave = joined && status === "upcoming"
  const accent = teamAccentStyles(session.team?.color)

  // Overlap warning compares against the viewer's upcoming program (own team + joined TS), as on Objevovat.
  let conflictText: string | null = null
  if (canJoin) {
    const commitments = (await listViewerSessions(supabase, viewer, { from: now.toISOString() })).map(toTiming)
    const conflict = findConflicts(toTiming(session), commitments)[0]
    conflictText = conflict ? `Kryje se s tvým TS · ${formatTimeRange(conflict.overlapStart, conflict.overlapEnd)}` : null
  }

  const isFacilitator = session.facilitators.some((f) => f.profile?.id === profile.id)
  const preparationJson = (session.preparation?.content_json as object | null) ?? null
  // Own team gets tabs (Docházka, Reflexe); everyone else sees the preparation under a plain heading.
  const hasTabs = isOwnTeam
  const canCopyPreparation =
    !isFacilitator &&
    Boolean(session.preparation?.published_at) &&
    preparationJson !== null &&
    contentTextFromJson(preparationJson) !== ""
  const preparation = (
    <PreparationPanel
      sessionId={session.id}
      topic={session.topic}
      canEdit={isFacilitator}
      showCopy={hasTabs}
      upcoming={status === "upcoming"}
      contentJson={preparationJson}
      publishedAt={session.preparation?.published_at ?? null}
    />
  )
  const panels: SessionDetailPanels = { priprava: preparation }

  if (isOwnTeam) {
    const [members, attendance, reflection] = await Promise.all([
      listTeamMembers(supabase, session.team_id),
      listAttendance(supabase, session.id),
      getReflection(supabase, session.id),
    ])
    const memberIds = new Set(members.map((m) => m.id))
    const guestPeople: TeamMemberProfile[] = session.guests.flatMap((g) =>
      g.profile && !memberIds.has(g.profile.id)
        ? [{ id: g.profile.id, name: g.profile.name, picture: g.profile.picture, role: GUEST_ROLE }]
        : [],
    )
    panels.dochazka = (
      <AttendancePanel
        sessionId={session.id}
        people={[...members, ...guestPeople]}
        initial={attendance.map((a) => ({ profileId: a.profile_id, status: a.status }))}
      />
    )
    panels.reflexe = (
      <ReflectionPanel
        sessionId={session.id}
        started={new Date(session.starts_at).getTime() <= now.getTime()}
        contentJson={(reflection?.content_json as object | null) ?? null}
        lastEditor={reflection?.updated_by?.name ?? null}
        updatedAt={reflection?.updated_at ?? null}
      />
    )
  }

  const facilitators = session.facilitators.flatMap((f) => (f.profile ? [f.profile] : []))
  const hasBadges = status === "ongoing" || status === "cancelled" || isOwnTeam || joined

  return (
    <PageShell size="medium">
      <PageHeader
        title={session.topic}
        back={{ href: isOwnTeam || joined ? TS_ROUTES.overview : TS_ROUTES.discover, label: isOwnTeam || joined ? "Přehled" : "Objevovat" }}
        action={isOwnTeam ? <SessionActionsMenu sessionId={session.id} cancelled={status === "cancelled"} /> : undefined}
      />
      <FeedRefresher />

      <div className="space-y-8">
        {hasBadges && (
          <div className="flex flex-wrap items-center gap-1.5">
            {status === "ongoing" && (
              <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/10 font-medium text-success-strong">
                <span className="size-1.5 animate-pulse rounded-full bg-success motion-reduce:animate-none" />
                Právě probíhá
              </Badge>
            )}
            {status === "cancelled" && <Badge variant="destructive">Zrušeno</Badge>}
            {isOwnTeam && <Badge variant="secondary">Můj tým</Badge>}
            {joined && <Badge variant="secondary">Přihlášeno</Badge>}
          </div>
        )}

        <div className="relative pl-4 sm:pl-5">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 rounded-full bg-primary" style={accent.stripe} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[7rem_1fr] sm:items-center sm:gap-y-3">
            {session.team && (
              <Fact label="Tým">
                <span className="font-semibold">{session.team.name}</span>
              </Fact>
            )}
            <Fact label="Kdy">
              <span className="font-medium">{formatDayHeading(session.starts_at)}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="tabular-nums">{formatTimeRange(session.starts_at, session.ends_at)}</span>
            </Fact>
            {location && <Fact label="Kde">{location}</Fact>}
            {facilitators.length > 0 && (
              <Fact label="Facilitace">
                <PeopleChips people={facilitators} />
              </Fact>
            )}
            <Fact label={session.guest_capacity > 0 ? `Crossy ${session.guests.length}/${session.guest_capacity}` : "Crossy"}>
              {session.guest_capacity === 0 ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden />
                  Pouze pro členy týmu
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {session.guests.map((g) => {
                    const isViewer = g.profile_id === profile.id
                    return (
                      <span
                        key={g.profile_id}
                        className={cn(PERSON_CHIP_CLASS, isViewer && "bg-primary/10 pr-1.5")}
                      >
                        <ProfileAvatar picture={g.profile?.picture} name={g.profile?.name} size={24} />
                        <span>
                          {g.profile?.name ?? UNNAMED_PERSON}
                          {isViewer ? " (ty)" : ""}
                        </span>
                        {isViewer && canLeave && (
                          <GuestJoinButton sessionId={session.id} joined conflictText={null} variant="icon" />
                        )}
                      </span>
                    )
                  })}
                  {canJoin && (
                    <GuestJoinButton sessionId={session.id} joined={false} conflictText={conflictText} variant="badge" />
                  )}
                  {session.guests.length === 0 && !canJoin && (
                    <span className="text-muted-foreground">Zatím nikdo</span>
                  )}
                  {isFull && !joined && !isOwnTeam && (
                    <span className="text-muted-foreground">Obsazeno</span>
                  )}
                </div>
              )}
            </Fact>
          </dl>
        </div>

        {conflictText && (
          <p className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning-strong">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {conflictText}
          </p>
        )}

        {session.description && (
          <section aria-labelledby="ts-goal" className="space-y-2">
            <h2 id="ts-goal" className="font-heading text-lg font-semibold">
              Cíl
            </h2>
            <p className="whitespace-pre-line text-base leading-relaxed text-foreground/90">{session.description}</p>
          </section>
        )}

        {hasTabs ? (
          <Suspense>
            <SessionDetailTabs panels={panels} />
          </Suspense>
        ) : (
          <section aria-labelledby="ts-preparation" className="space-y-3">
            <div className="flex items-center gap-1.5">
              <h2 id="ts-preparation" className="font-heading text-lg font-semibold">
                Příprava
              </h2>
              {canCopyPreparation && preparationJson && (
                <CopyPreparationButton topic={session.topic} contentJson={preparationJson} />
              )}
            </div>
            {preparation}
          </section>
        )}
      </div>
    </PageShell>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="pb-2 text-sm text-foreground last:pb-0 sm:pb-0">{children}</dd>
    </>
  )
}

function PeopleChips({ people }: { people: TsPersonSummary[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {people.map((p) => (
        <span key={p.id} className={PERSON_CHIP_CLASS}>
          <ProfileAvatar picture={p.picture} name={p.name} size={24} />
          <span>{p.name ?? UNNAMED_PERSON}</span>
        </span>
      ))}
    </div>
  )
}
