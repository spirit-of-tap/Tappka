import { CircleAlert, MapPin, Users } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { SessionConflict } from "@/lib/training-sessions/conflicts"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatTimeRange } from "@/lib/training-sessions/format"
import { getSessionStatus } from "@/lib/training-sessions/status"
import { toTiming, type SessionTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"
import { cn } from "@/lib/utils"

import { GuestJoinButton } from "./guest-join-button"

export interface SessionViewer {
  profileId: string
  teamId: string | null
}

interface SessionCardProps {
  session: TrainingSessionListItem
  viewer: SessionViewer
  conflicts: SessionConflict<SessionTiming>[]
  now: string
}

export function SessionCard({ session, viewer, conflicts, now }: SessionCardProps) {
  const status = getSessionStatus(toTiming(session), new Date(now))
  const isCancelled = status === "cancelled"
  const isOwnTeam = viewer.teamId !== null && viewer.teamId === session.team_id
  const guestCount = session.guests.length
  const joined = session.guests.some((g) => g.profile_id === viewer.profileId)
  const isFull = guestCount >= session.guest_capacity
  const canShowGuestControls = !isOwnTeam && session.guest_capacity > 0 && status === "upcoming"
  const conflict = conflicts[0]
  const conflictText = conflict
    ? `Kryje se s tvým TS · ${formatTimeRange(conflict.overlapStart, conflict.overlapEnd)}`
    : null
  const facilitatorNames = session.facilitators
    .map((f) => f.profile?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ")
  const location = session.room?.code ?? session.location_note
  // Team color is user data; an invalid value is dropped by the browser, leaving the bg-primary fallback.
  const teamColor = session.team?.color ?? undefined

  return (
    <article className={cn("rounded-xl border bg-card p-4 transition-colors", isCancelled && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">
          {formatTimeRange(session.starts_at, session.ends_at)}
        </span>
        {session.team && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 rounded-full bg-primary"
              style={teamColor ? { backgroundColor: teamColor } : undefined}
            />
            {session.team.name}
          </span>
        )}
        {isOwnTeam && <Badge variant="secondary">Můj tým</Badge>}
        {joined && <Badge variant="secondary">Přihlášeno</Badge>}
        {isCancelled && <Badge variant="destructive">Zrušeno</Badge>}
      </div>

      <Link
        href={TS_ROUTES.detail(session.id)}
        className="mt-2 block rounded-sm font-heading text-lg font-semibold leading-snug hover:underline focus-ring"
      >
        {session.topic}
      </Link>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {location}
          </span>
        )}
        {facilitatorNames && <span>Facilitace: {facilitatorNames}</span>}
        {isOwnTeam && (
          <span>{session.preparation?.published_at ? "Příprava je zveřejněná" : "Příprava zatím chybí"}</span>
        )}
      </div>

      {conflictText && !isCancelled && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning-strong">
          <CircleAlert className="size-3.5" aria-hidden />
          {conflictText}
        </p>
      )}

      {canShowGuestControls && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden />
            {isFull && !joined ? "Obsazeno" : `${guestCount}/${session.guest_capacity} míst`}
          </span>
          {(!isFull || joined) && (
            <GuestJoinButton sessionId={session.id} joined={joined} conflictText={conflictText} />
          )}
        </div>
      )}
    </article>
  )
}
