import { AlertCircle, CheckCircle2, ChevronRight, CircleAlert, Clock, MapPin, UserCheck } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { ProfileAvatar } from "@/components/profile-avatar"
import { Badge } from "@/components/ui/badge"
import type { SessionConflict } from "@/lib/training-sessions/conflicts"
import { TS_ROUTES } from "@/lib/training-sessions/constants"
import { formatDayHeading, formatPeopleList, formatTimeRange, teamAccentStyles } from "@/lib/training-sessions/format"
import { getSessionStatus } from "@/lib/training-sessions/status"
import {
  toTiming,
  type SessionTiming,
  type SessionViewer,
  type TrainingSessionListItem,
  type TsPersonSummary,
} from "@/lib/training-sessions/types"
import { cn } from "@/lib/utils"

import { GuestJoinButton } from "./guest-join-button"

export type { SessionViewer } from "@/lib/training-sessions/types"

const AVATAR_PREVIEW_COUNT = 3
/** Seats drawn before the rest collapse into "+N", so a 50-seat TS doesn't fill the card. */
const SEATS_SHOWN_MAX = 6
const SEAT_AVATAR_SIZE = 24
const GUEST_NAMES_SHOWN = 2

interface SessionCardProps {
  session: TrainingSessionListItem
  viewer: SessionViewer
  conflicts: SessionConflict<SessionTiming>[]
  now: string
  showDate?: boolean
  /** Room matters for TS you attend; when browsing other teams' TS it is noise. */
  showLocation?: boolean
}

export function SessionCard({ session, viewer, conflicts, now, showDate, showLocation = true }: SessionCardProps) {
  const status = getSessionStatus(toTiming(session), new Date(now))
  const isCancelled = status === "cancelled"
  const isOngoing = status === "ongoing"
  const isUpcoming = status === "upcoming" || isOngoing
  const isOwnTeam = viewer.teamId !== null && viewer.teamId === session.team_id
  const guestCount = session.guests.length
  const joined = session.guests.some((g) => g.profile_id === viewer.profileId)
  const isAttending = isOwnTeam || joined
  const isFull = guestCount >= session.guest_capacity
  const canShowGuestControls = !isOwnTeam && session.guest_capacity > 0 && status === "upcoming"
  // Free spots only make sense while people can still join; afterwards just list who came.
  const showSeats = session.guest_capacity > 0 && isUpcoming && !isCancelled
  const conflict = conflicts[0]
  const conflictText = conflict
    ? `Kryje se s tvým TS · ${formatTimeRange(conflict.overlapStart, conflict.overlapEnd)}`
    : null
  const facilitators = session.facilitators.flatMap((f) => (f.profile ? [f.profile] : []))
  const guests = session.guests.flatMap((g) => (g.profile ? [g.profile] : []))
  const location = session.room?.code ?? session.location_note
  const hasPreparation = Boolean(session.preparation?.published_at)
  const accent = teamAccentStyles(session.team?.color)
  const showPreparation = isUpcoming && !isCancelled
  const hasMeta = (showLocation && Boolean(location)) || showPreparation

  // One spot answers "am I going?": a status pill when attending, otherwise the join action.
  let attendance: ReactNode = null
  if (isUpcoming && !isCancelled) {
    if (isOwnTeam) attendance = <AttendingPill label="Jdeš · tvůj tým" />
    else if (joined) {
      attendance = canShowGuestControls ? (
        <GuestJoinButton sessionId={session.id} joined conflictText={null} variant="status" />
      ) : (
        <AttendingPill label="Jdeš jako cross" />
      )
    } else if (canShowGuestControls) {
      attendance = isFull ? (
        <span className="text-sm font-medium text-muted-foreground">Obsazeno</span>
      ) : (
        <GuestJoinButton sessionId={session.id} joined={false} conflictText={conflictText} />
      )
    }
  }

  return (
    <article
      style={accent.surface}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 pl-5 shadow-xs transition-colors sm:p-5 sm:pl-6",
        "hover:border-border/80",
        isOngoing && "border-success/40 ring-1 ring-success/20",
        isCancelled && "opacity-60",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-primary" style={accent.stripe} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {showDate && <span className="font-semibold text-foreground">{formatDayHeading(session.starts_at)}</span>}
          <span className="inline-flex items-center gap-1 font-medium tabular-nums text-foreground">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden />
            {formatTimeRange(session.starts_at, session.ends_at)}
          </span>
          {session.team && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" style={accent.stripe} />
              {session.team.name}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isOngoing && (
            <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/10 font-medium text-success-strong">
              <span className="size-1.5 animate-pulse rounded-full bg-success motion-reduce:animate-none" />
              Právě probíhá
            </Badge>
          )}
          {isCancelled && <Badge variant="destructive">Zrušeno</Badge>}
        </div>
      </div>

      <Link
        href={TS_ROUTES.detail(session.id)}
        className="group/link mt-1.5 flex items-start justify-between gap-2 rounded-sm font-heading text-lg font-semibold leading-snug text-foreground hover:underline focus-ring"
      >
        <span>{session.topic}</span>
        <ChevronRight
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover/link:translate-x-0.5 group-hover/link:text-foreground motion-reduce:transition-none"
          aria-hidden
        />
      </Link>

      {session.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{session.description}</p>}

      <dl className="mt-3 grid gap-1.5 text-sm">
        {facilitators.length > 0 && <PeopleRow label="Facilitace" people={facilitators} />}
        {showSeats ? (
          <CrossSeats guests={guests} capacity={session.guest_capacity} />
        ) : (
          guests.length > 0 && <PeopleRow label="Crossy" people={guests} />
        )}
      </dl>

      {conflictText && !isCancelled && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-strong">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {conflictText}
        </p>
      )}

      {(hasMeta || attendance) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
            {showLocation && location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {location}
              </span>
            )}
            {showPreparation && (
              <span className="inline-flex items-center gap-1">
                {hasPreparation ? (
                  <>
                    <CheckCircle2 className="size-3.5 shrink-0 text-success-strong" aria-hidden />
                    <span>Příprava je připravená</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className={cn("size-3.5 shrink-0", isAttending && "text-warning-strong")} aria-hidden />
                    <span className={cn(isAttending && "font-medium text-warning-strong")}>Příprava zatím chybí</span>
                  </>
                )}
              </span>
            )}
          </div>
          {attendance && <div className="ml-auto flex shrink-0 items-center gap-2">{attendance}</div>}
        </div>
      )}
    </article>
  )
}

function PeopleRow({ label, people }: { label: string; people: TsPersonSummary[] }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="w-20 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden className="flex shrink-0 -space-x-1.5">
          {people.slice(0, AVATAR_PREVIEW_COUNT).map((p) => (
            <ProfileAvatar key={p.id} picture={p.picture} name={p.name} size={20} className="ring-2 ring-card" />
          ))}
        </span>
        <span className="truncate text-foreground/90">
          {formatPeopleList(people.map((p) => p.name ?? "Bez jména"))}
        </span>
      </dd>
    </div>
  )
}

interface CrossSeatsProps {
  guests: TsPersonSummary[]
  capacity: number
}

/** Joined crosses as avatars and free spots as empty dashed seats. */
function CrossSeats({ guests, capacity }: CrossSeatsProps) {
  const filled = guests.slice(0, SEATS_SHOWN_MAX)
  const emptyShown = Math.max(0, Math.min(capacity - guests.length, SEATS_SHOWN_MAX - filled.length))
  const hidden = Math.max(0, capacity - filled.length - emptyShown)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="w-20 shrink-0 text-xs text-muted-foreground">Crossy</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span
          role="img"
          aria-label={`Obsazeno ${guests.length} z ${capacity} míst`}
          className="flex shrink-0 items-center gap-1"
        >
          {filled.map((p) => (
            <ProfileAvatar key={p.id} picture={p.picture} name={p.name} size={SEAT_AVATAR_SIZE} />
          ))}
          {Array.from({ length: emptyShown }, (_, i) => (
            <span
              key={i}
              className="size-6 shrink-0 rounded-full border border-dashed border-muted-foreground/50 bg-background/60"
            />
          ))}
          {hidden > 0 && <span className="pl-0.5 text-xs text-muted-foreground">+{hidden}</span>}
        </span>
        {guests.length > 0 && (
          <span className="truncate text-foreground/90">
            {formatPeopleList(
              guests.map((p) => p.name ?? "Bez jména"),
              GUEST_NAMES_SHOWN,
            )}
          </span>
        )}
      </dd>
    </div>
  )
}

function AttendingPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success-strong">
      <UserCheck className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  )
}
