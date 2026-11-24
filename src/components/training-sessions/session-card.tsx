import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock,
  MapPin,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProfileAvatar } from "@/components/profile-avatar";
import { Badge } from "@/components/ui/badge";
import type { SessionConflict } from "@/lib/training-sessions/conflicts";
import { TS_ROUTES } from "@/lib/training-sessions/constants";
import {
  formatConflict,
  formatDayHeading,
  formatPeopleList,
  formatTime,
  formatTimeRange,
  teamAccentStyles,
} from "@/lib/training-sessions/format";
import { getSessionStatus } from "@/lib/training-sessions/status";
import {
  toTiming,
  type SessionTiming,
  type SessionViewer,
  type TrainingSessionListItem,
  type TsPersonSummary,
} from "@/lib/training-sessions/types";
import { cn } from "@/lib/utils";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";

import { GuestJoinButton } from "./guest-join-button";

export type { SessionViewer } from "@/lib/training-sessions/types";

const AVATAR_PREVIEW_COUNT = 3;
/** Seats drawn before the rest collapse into "+N", so a 50-seat TS doesn't fill the card. */
const SEATS_SHOWN_MAX = 6;
const SEAT_AVATAR_SIZE = 24;
const GUEST_NAMES_SHOWN = 2;

interface SessionCardProps {
  session: TrainingSessionListItem;
  viewer: SessionViewer;
  conflicts: SessionConflict<SessionTiming>[];
  now: string;
  showDate?: boolean;
  /** Room matters for TS you attend; when browsing other teams' TS it is noise. */
  showLocation?: boolean;
  /** Preparation state is useful for your own programme, not when browsing other teams. */
  showPreparation?: boolean;
  /** Dark hero treatment for the nearest session. */
  featured?: boolean;
}

export function SessionCard({
  session,
  viewer,
  conflicts,
  now,
  showDate,
  showLocation = true,
  showPreparation = true,
  featured = false,
}: SessionCardProps) {
  const timing = toTiming(session);
  const status = getSessionStatus(timing, new Date(now));
  const isCancelled = status === "cancelled";
  const isOngoing = status === "ongoing";
  const isUpcoming = status === "upcoming" || isOngoing;
  const isOwnTeam = viewer.teamId !== null && viewer.teamId === session.team_id;
  const guestCount = session.guests.length;
  const joined = session.guests.some((g) => g.profile_id === viewer.profileId);
  const isAttending = isOwnTeam || joined;
  const isFull = guestCount >= session.guest_capacity;
  const canShowGuestControls =
    !isOwnTeam && session.guest_capacity > 0 && status === "upcoming";
  // Free spots only make sense while people can still join; afterwards just list who came.
  const showSeats = session.guest_capacity > 0 && isUpcoming && !isCancelled;
  const conflict = conflicts[0];
  const conflictChip = conflict ? formatConflict(timing, conflict) : null;
  // The chip sits next to the time; the dialog needs the full sentence because the time is not in view there.
  const conflictSentence = conflict
    ? formatConflict(timing, conflict, "sentence")
    : null;
  const facilitators = session.facilitators.flatMap((f) =>
    f.profile ? [f.profile] : [],
  );
  const guests = session.guests.flatMap((g) => (g.profile ? [g.profile] : []));
  const location = session.room?.code ?? session.location_note;
  const hasPreparation = Boolean(session.preparation?.published_at);
  const accent = teamAccentStyles(session.team?.color);
  const showPreparationState = showPreparation && isUpcoming && !isCancelled;
  const showAttending = isAttending && isUpcoming && !isCancelled;
  const tinted = showAttending && !featured;
  const muted = featured ? "text-hero-muted" : tinted ? "text-foreground" : "text-muted-foreground";
  const hasMeta = (showLocation && Boolean(location)) || showPreparationState;

  // One spot answers "am I going?": a status pill when attending, otherwise the join action.
  let attendance: ReactNode = null;
  if (isUpcoming && !isCancelled) {
    if (isOwnTeam) attendance = <AttendingPill label="Jdeš · tvůj tým" featured={featured} />;
    else if (joined) {
      attendance = canShowGuestControls ? (
        <GuestJoinButton
          sessionId={session.id}
          joined
          conflictText={null}
          variant="status"
        />
      ) : (
        <AttendingPill label="Jdeš jako cross" featured={featured} />
      );
    } else if (canShowGuestControls) {
      attendance = isFull ? (
        <span className="text-sm font-medium text-muted-foreground">
          Obsazeno
        </span>
      ) : (
        <GuestJoinButton
          sessionId={session.id}
          joined={false}
          conflictText={conflictSentence}
        />
      );
    }
  }

  return (
    <article
      style={featured || tinted ? undefined : accent.surface}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-4 motion-safe:transition motion-safe:duration-300 motion-safe:ease-out sm:p-5",
        featured
          ? "rounded-3xl bg-hero text-hero-foreground hover:shadow-md motion-safe:hover:-translate-y-1"
          : "border shadow-xs hover:shadow-md motion-safe:hover:-translate-y-0.5",
        !featured && (tinted ? "border-success/40 bg-success/10" : "bg-card"),
        featured && showAttending && "ring-2 ring-hero-success",
        isOngoing && !featured && "border-success/40 ring-1 ring-success/20",
        isCancelled && "opacity-60",
      )}
    >
      {showAttending && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0 w-1.5",
            featured ? "bg-hero-success" : "bg-success",
          )}
        />
      )}
      {featured && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -bottom-20 size-56 rounded-full border-[28px] border-hero-foreground/5 motion-safe:transition-[transform,border-color] motion-safe:duration-700 motion-safe:ease-out group-hover:border-hero-foreground/10 motion-safe:group-hover:-translate-x-6 motion-safe:group-hover:-translate-y-4 motion-safe:group-hover:scale-110"
        />
      )}

      <div className="relative flex gap-4 sm:gap-5">
        {featured ? (
          <DateLeaf startsAt={session.starts_at} />
        ) : (
          <TimeLeaf
            startsAt={session.starts_at}
            endsAt={session.ends_at}
            stripe={accent.stripe}
            attending={tinted}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm",
                muted,
              )}
            >
              {(showDate || featured) && (
                <span
                  className={cn(
                    "font-semibold",
                    featured ? "text-hero-foreground" : "text-foreground",
                  )}
                >
                  {formatDayHeading(session.starts_at)}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium tabular-nums",
                  !showDate && !featured && "sm:hidden",
                )}
              >
                <Clock className="size-3.5" aria-hidden />
                {formatTimeRange(session.starts_at, session.ends_at)}
              </span>
              {session.team && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-primary"
                    style={accent.stripe}
                  />
                  {session.team.name}
                </span>
              )}
              {conflictChip && !isCancelled && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
                    featured
                      ? "bg-hero-foreground/10 text-hero-foreground"
                      : "bg-chart-2/10 text-chart-2-strong",
                  )}
                >
                  <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                  {conflictChip}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {isOngoing && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 font-medium",
                    featured
                      ? "border-hero-foreground/20 bg-hero-foreground/10 text-hero-foreground"
                      : "border-success/30 bg-success/10 text-success-strong",
                  )}
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-success motion-reduce:animate-none" />
                  Právě probíhá
                </Badge>
              )}
              {isCancelled && <Badge variant="destructive">Zrušeno</Badge>}
            </div>
          </div>

          <Link
            href={TS_ROUTES.detail(session.id)}
            className={cn(
              "group/link mt-1 flex items-start justify-between gap-2 rounded-sm font-heading font-bold leading-snug hover:underline underline-offset-4",
              featured
                ? "focus-ring-hero text-xl text-hero-foreground md:text-2xl"
                : "focus-ring text-lg text-foreground",
            )}
          >
            <span>{session.topic}</span>
            <ChevronRight
              className={cn(
                "mt-1.5 size-4 shrink-0 motion-safe:transition-transform motion-safe:group-hover/link:translate-x-0.5",
                featured
                  ? "text-hero-muted group-hover/link:text-hero-foreground"
                  : "text-muted-foreground group-hover/link:text-foreground",
              )}
              aria-hidden
            />
          </Link>

          {session.description && (
            <p className={cn("mt-1 line-clamp-2 text-sm", muted)}>
              {session.description}
            </p>
          )}

          <dl className="mt-3 grid gap-1.5 text-sm">
            {facilitators.length > 0 && (
              <PeopleRow
                label="Facilitace"
                people={facilitators}
                featured={featured}
              />
            )}
            {showSeats ? (
              <CrossSeats
                guests={guests}
                capacity={session.guest_capacity}
                featured={featured}
              />
            ) : (
              guests.length > 0 && (
                <PeopleRow label="Crossy" people={guests} featured={featured} />
              )
            )}
          </dl>

          {(hasMeta || attendance) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm",
                  muted,
                )}
              >
                {showLocation && location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    {location}
                  </span>
                )}
                {showPreparationState && (
                  <span className="inline-flex items-center gap-1">
                    {hasPreparation ? (
                      <>
                        <CheckCircle2
                          className={cn(
                            "size-3.5 shrink-0",
                            featured
                              ? "text-hero-foreground"
                              : "text-success-strong",
                          )}
                          aria-hidden
                        />
                        <span>Příprava je hotová</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle
                          className={cn(
                            "size-3.5 shrink-0",
                            isAttending &&
                              (featured
                                ? "text-warning"
                                : "text-warning-strong"),
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            isAttending && "font-medium",
                            isAttending &&
                              (featured
                                ? "text-warning"
                                : "text-warning-strong"),
                          )}
                        >
                          Příprava zatím chybí
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
              {attendance && (
                <div
                  className={cn(
                    "ml-auto flex shrink-0 items-center gap-2",
                    featured && !showAttending && "rounded-full bg-card",
                  )}
                >
                  {attendance}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

const LEAF_TIME_ZONE = "Europe/Prague";

function DateLeaf({ startsAt }: { startsAt: string }) {
  const date = new Date(startsAt);
  const part = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString("cs-CZ", { ...options, timeZone: LEAF_TIME_ZONE });

  return (
    <div
      aria-hidden
      className="flex h-fit w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-primary py-3 text-primary-foreground motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out sm:w-20 motion-safe:group-hover:-rotate-3 motion-safe:group-hover:scale-105"
    >
      <span className="text-[11px] font-bold uppercase tracking-widest">
        {part({ weekday: "short" })}
      </span>
      <span className="font-heading text-3xl font-extrabold leading-none">
        {part({ day: "numeric" })}
      </span>
      <span className="text-[11px]">{part({ month: "long" })}</span>
    </div>
  );
}

function TimeLeaf({
  startsAt,
  endsAt,
  stripe,
  attending,
}: {
  startsAt: string;
  endsAt: string;
  stripe: { backgroundColor: string } | undefined;
  attending: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative hidden h-fit w-16 shrink-0 flex-col items-center gap-0.5 overflow-hidden rounded-xl px-1 pt-3.5 pb-2.5 sm:flex",
        attending ? "bg-success/20" : "bg-muted",
      )}
    >
      <span
        className="absolute inset-x-0 top-0 h-1.5 bg-primary"
        style={stripe}
      />
      <span className="font-heading text-lg font-extrabold leading-none tabular-nums text-foreground">
        {formatTime(startsAt)}
      </span>
      <span
        className={cn(
          "text-xs tabular-nums",
          attending ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {formatTime(endsAt)}
      </span>
    </div>
  );
}

function PeopleRow({
  label,
  people,
  featured,
}: {
  label: string;
  people: TsPersonSummary[];
  featured: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt
        className={cn(
          "w-20 shrink-0 text-xs",
          featured ? "text-hero-muted" : "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden className="flex shrink-0 -space-x-1.5">
          {people.slice(0, AVATAR_PREVIEW_COUNT).map((p) => (
            <ProfileAvatar
              key={p.id}
              picture={p.picture}
              name={p.name}
              size={20}
              className={featured ? "ring-2 ring-hero" : "ring-2 ring-card"}
            />
          ))}
        </span>
        <span
          className={cn(
            "truncate",
            featured ? "text-hero-foreground/90" : "text-foreground/90",
          )}
        >
          {formatPeopleList(people.map((p) => p.name ?? "Bez jména"))}
        </span>
      </dd>
    </div>
  );
}

interface CrossSeatsProps {
  guests: TsPersonSummary[];
  capacity: number;
  featured: boolean;
}

/** Joined crosses as avatars and free spots as empty dashed seats. */
function CrossSeats({ guests, capacity, featured }: CrossSeatsProps) {
  const filled = guests.slice(0, SEATS_SHOWN_MAX);
  const emptyShown = Math.max(
    0,
    Math.min(capacity - guests.length, SEATS_SHOWN_MAX - filled.length),
  );
  const hidden = Math.max(0, capacity - filled.length - emptyShown);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt
        className={cn(
          "w-20 shrink-0 text-xs",
          featured ? "text-hero-muted" : "text-muted-foreground",
        )}
      >
        Crossy
      </dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span
          role="img"
          aria-label={`Obsazeno ${guests.length} z ${capacity} ${pluralizeCz(capacity, ["místa", "míst", "míst"])}`}
          className="flex shrink-0 items-center gap-1"
        >
          {filled.map((p) => (
            <ProfileAvatar
              key={p.id}
              picture={p.picture}
              name={p.name}
              size={SEAT_AVATAR_SIZE}
            />
          ))}
          {Array.from({ length: emptyShown }, (_, i) => (
            <span
              key={i}
              className={cn(
                "size-6 shrink-0 rounded-full border border-dashed",
                featured
                  ? "border-hero-foreground/40"
                  : "border-muted-foreground/50 bg-background/60",
              )}
            />
          ))}
          {hidden > 0 && (
            <span
              className={cn(
                "pl-0.5 text-xs",
                featured ? "text-hero-muted" : "text-muted-foreground",
              )}
            >
              +{hidden}
            </span>
          )}
        </span>
        {guests.length > 0 && (
          <span
            className={cn(
              "truncate",
              featured ? "text-hero-foreground/90" : "text-foreground/90",
            )}
          >
            {formatPeopleList(
              guests.map((p) => p.name ?? "Bez jména"),
              GUEST_NAMES_SHOWN,
            )}
          </span>
        )}
      </dd>
    </div>
  );
}

function AttendingPill({
  label,
  featured,
}: {
  label: string;
  featured: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
        featured
          ? "bg-hero-success text-hero"
          : "bg-success-strong text-background",
      )}
    >
      <UserCheck className="size-4 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
