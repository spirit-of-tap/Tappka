import { AlertCircle, CheckCircle2, ChevronRight, CircleAlert, Clock, MapPin, Users } from "lucide-react"
import Link from "next/link"

import { ProfileAvatar } from "@/components/profile-avatar"
import { Badge } from "@/components/ui/badge"
import type { SessionConflict } from "@/lib/training-sessions/conflicts"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatDayHeading, formatTimeRange } from "@/lib/training-sessions/format"
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
  showDate?: boolean
}

export function SessionCard({ session, viewer, conflicts, now, showDate }: SessionCardProps) {
  const status = getSessionStatus(toTiming(session), new Date(now))
  const isCancelled = status === "cancelled"
  const isOngoing = status === "ongoing"
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
    <article
      className={cn(
        "group relative rounded-xl border bg-card p-4 transition-all duration-150 sm:p-5 shadow-xs",
        "hover:border-border/80 hover:bg-card/90",
        isOngoing && "border-emerald-500/40 bg-emerald-500/[0.03] ring-1 ring-emerald-500/20",
        isCancelled && "opacity-60 bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {showDate && (
            <span className="font-semibold text-foreground">
              {formatDayHeading(session.starts_at)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 font-medium tabular-nums text-foreground">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden />
            {formatTimeRange(session.starts_at, session.ends_at)}
          </span>
          {session.team && (
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
              <span
                aria-hidden
                className="size-2 rounded-full bg-primary shrink-0"
                style={teamColor ? { backgroundColor: teamColor } : undefined}
              />
              {session.team.name}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isOngoing && (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1.5 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Právě probíhá
            </Badge>
          )}
          {isOwnTeam && <Badge variant="secondary">Můj tým</Badge>}
          {joined && <Badge variant="secondary">Přihlášeno</Badge>}
          {isCancelled && <Badge variant="destructive">Zrušeno</Badge>}
        </div>
      </div>

      <Link
        href={TS_ROUTES.detail(session.id)}
        className="group/link mt-2 flex items-start justify-between gap-2 rounded-sm font-heading text-lg font-semibold leading-snug hover:underline focus-ring text-foreground"
      >
        <span>{session.topic}</span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/link:translate-x-0.5 group-hover/link:text-foreground mt-1"
          aria-hidden
        />
      </Link>

      {session.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {session.description}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-muted-foreground">
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {location}
          </span>
        )}
        {session.facilitators.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="flex -space-x-1 overflow-hidden shrink-0">
              {session.facilitators.slice(0, 2).map((f) => (
                <ProfileAvatar
                  key={f.profile?.id ?? Math.random()}
                  picture={f.profile?.picture}
                  name={f.profile?.name}
                  size={18}
                  className="ring-1 ring-card"
                />
              ))}
            </span>
            <span>Facilitace: {facilitatorNames}</span>
          </span>
        )}
        {isOwnTeam && (
          <span className="inline-flex items-center gap-1">
            {session.preparation?.published_at ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
                <span>Příprava je zveřejněná</span>
              </>
            ) : (
              <>
                <AlertCircle className="size-3.5 text-warning-strong shrink-0" aria-hidden />
                <span className="font-medium text-warning-strong">Příprava zatím chybí</span>
              </>
            )}
          </span>
        )}
      </div>

      {conflictText && !isCancelled && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-strong">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {conflictText}
        </p>
      )}

      {canShowGuestControls && (
        <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-4 shrink-0" aria-hidden />
              {isFull && !joined ? "Obsazeno" : `${guestCount}/${session.guest_capacity} míst`}
            </span>
            {session.guests.length > 0 && (
              <span aria-hidden="true" className="hidden xs:flex -space-x-1.5 overflow-hidden">
                {session.guests.slice(0, 3).map((g) => (
                  <ProfileAvatar
                    key={g.profile_id}
                    picture={g.profile?.picture}
                    name={g.profile?.name}
                    size={20}
                    className="ring-1.5 ring-card"
                  />
                ))}
              </span>
            )}
          </div>
          {(!isFull || joined) && (
            <GuestJoinButton sessionId={session.id} joined={joined} conflictText={conflictText} />
          )}
        </div>
      )}
    </article>
  )
}

