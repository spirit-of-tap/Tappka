import { MapPin, Users } from "lucide-react"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { cache, Suspense } from "react"

import { AttendancePanel } from "@/components/training-sessions/attendance-panel"
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
import { createClient } from "@/lib/supabase/server"
import { findConflicts } from "@/lib/training-sessions/conflicts"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatDayHeading, formatTimeRange } from "@/lib/training-sessions/format"
import { getReflection, getSessionDetail, listAttendance, listSessions } from "@/lib/training-sessions/queries"
import { getSessionStatus } from "@/lib/training-sessions/status"
import { toTiming, type TrainingSessionDetail } from "@/lib/training-sessions/types"
import { listTeamMembers } from "@/lib/tymovy-denik/queries"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"

const FALLBACK_METADATA: Metadata = {
  title: "Detail TS",
  description: "Téma, příprava, docházka a týmová reflexe tréninkové session",
}

const GUEST_ROLE = "student"
const UNNAMED_PERSON = "Bez jména"

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
  const isOwnTeam = profile.team_id !== null && profile.team_id === session.team_id
  const joined = session.guests.some((g) => g.profile_id === profile.id)
  const location = session.room?.code ?? session.location_note
  const facilitatorNames = session.facilitators
    .map((f) => f.profile?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ")
  const canShowGuestControls =
    !isOwnTeam &&
    status === "upcoming" &&
    session.guest_capacity > 0 &&
    (joined || session.guests.length < session.guest_capacity)

  // Overlap warning compares against the viewer's upcoming program (own team + joined TS), as on Objevovat.
  let conflictText: string | null = null
  if (canShowGuestControls && !joined) {
    const upcoming = await listSessions(supabase, { from: now.toISOString() })
    const commitments = upcoming
      .filter((s) => s.team_id === profile.team_id || s.guests.some((g) => g.profile_id === profile.id))
      .map(toTiming)
    const conflict = findConflicts(toTiming(session), commitments)[0]
    conflictText = conflict
      ? `Kryje se s tvým TS · ${formatTimeRange(conflict.overlapStart, conflict.overlapEnd)}`
      : null
  }

  const overview = (
    <div className="space-y-3 text-sm">
      {session.description && <p className="whitespace-pre-line">{session.description}</p>}
      <p className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Users className="size-4" aria-hidden />
        Místa pro jiné týmy: {session.guests.length}/{session.guest_capacity}
      </p>
      {session.guests.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {session.guests.map((g) => (
            <li key={g.profile_id}>
              <Badge variant="secondary">{g.profile?.name ?? UNNAMED_PERSON}</Badge>
            </li>
          ))}
        </ul>
      )}
      {canShowGuestControls && <GuestJoinButton sessionId={session.id} joined={joined} conflictText={conflictText} />}
    </div>
  )

  const panels: SessionDetailPanels = {
    prehled: overview,
    priprava: (
      <PreparationPanel
        sessionId={session.id}
        canEdit={isOwnTeam}
        contentJson={(session.preparation?.content_json as object | null) ?? null}
        publishedAt={session.preparation?.published_at ?? null}
      />
    ),
  }

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

  return (
    <PageShell size="medium">
      <PageHeader
        title={session.topic}
        description={buildHeaderDescription(session)}
        back={{ href: TS_ROUTES.discover, label: "Objevovat" }}
        action={isOwnTeam ? <SessionActionsMenu sessionId={session.id} cancelled={status === "cancelled"} /> : undefined}
      />
      <FeedRefresher />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {status === "cancelled" && <Badge variant="destructive">Zrušeno</Badge>}
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {location}
          </span>
        )}
        {facilitatorNames && <span>Facilitace: {facilitatorNames}</span>}
      </div>
      <Suspense>
        <SessionDetailTabs panels={panels} />
      </Suspense>
    </PageShell>
  )
}
