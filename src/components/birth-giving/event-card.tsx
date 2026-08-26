import Link from "next/link";
import { ChevronRight, Users, Trophy, Briefcase, UserCheck, MessageSquareQuote, MessageSquarePlus, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import { getEventTimeState } from "@/lib/birth-giving/time";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";
import { cn } from "@/lib/utils";
import type { BirthGivingEventIndexItem } from "@/lib/birth-giving/types";

interface BirthGivingEventCardProps {
  event: BirthGivingEventIndexItem;
  now: string;
  profileId?: string;
}

const MONTH_NAMES = [
  "Led", "Úno", "Bře", "Dub", "Kvě", "Čvn",
  "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"
];

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function BirthGivingEventCard({ event, now, profileId }: BirthGivingEventCardProps) {
  const nowDate = new Date(now);
  const startsAt = new Date(event.starts_at);
  const timeState = getEventTimeState(startsAt, event.duration, nowDate);
  const isOrganizer = profileId ? event.organizer_profile_ids?.includes(profileId) : false;
  const isParticipant = profileId ? event.participant_profile_ids?.includes(profileId) : false;
  const isConcluded = timeState === "ended";
  const isToday = isSameDay(startsAt, nowDate);
  const isActive = timeState === "active";
  const isTodayOrActive = isActive || isToday;
  const isGrayedOut = isConcluded && !isParticipant && !isOrganizer && !isTodayOrActive;

  // Find user's team and personal reflection
  const userTeam = profileId && event.teams
    ? event.teams.find((team) => team.members?.some((member) => member.profile_id === profileId))
    : null;
  const userMembership = profileId && userTeam
    ? userTeam.members?.find((member) => member.profile_id === profileId)
    : null;
  const userReflection = userMembership?.reflection_contribution || userMembership?.reflection_learning;
  const isMissingReflection = isParticipant && isConcluded && !userReflection;

  const dayNum = startsAt.getDate();
  const monthStr = MONTH_NAMES[startsAt.getMonth()] ?? "";
  const timeStr = startsAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  const fullDateStr = startsAt.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

  return (
    <Link
      href={`/birth-giving/${event.id}`}
      className={cn(
        "group relative flex flex-col justify-between gap-3 rounded-2xl border transition-all duration-150 focus-ring",
        isTodayOrActive
          ? "border-2 border-emerald-500/60 bg-emerald-500/[0.08] dark:bg-emerald-950/25 hover:border-emerald-500/90 hover:bg-emerald-500/[0.13] shadow-sm ring-1 ring-emerald-500/20 p-4.5 sm:p-5.5 mb-3.5 sm:mb-4.5"
          : isMissingReflection
          ? "border-amber-500/50 bg-amber-500/[0.04] hover:border-amber-500/80 hover:bg-amber-500/[0.08] shadow-xs p-3.5 sm:p-4"
          : isGrayedOut
          ? "border-border/30 bg-card/30 opacity-65 hover:opacity-100 hover:border-border/60 hover:bg-card/60 p-3.5 sm:p-4"
          : isParticipant
          ? "border-border/60 bg-card/75 hover:border-primary/50 hover:bg-accent/40 shadow-xs p-3.5 sm:p-4"
          : "border-border/40 bg-card/60 hover:border-border hover:bg-accent/40 p-3.5 sm:p-4",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {/* Date block */}
          <div
            className={cn(
              "flex flex-col items-center justify-center size-12 shrink-0 rounded-lg border text-center select-none",
              isTodayOrActive
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold"
                : isMissingReflection
                ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold"
                : isGrayedOut
                ? "border-border/40 bg-muted/20 text-muted-foreground"
                : "border-border/50 bg-muted/40 text-foreground",
            )}
          >
            <span className="text-base font-bold leading-none font-heading">
              {dayNum}
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground mt-0.5">
              {monthStr}
            </span>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3
                className={cn(
                  "font-heading text-base font-semibold tracking-tight transition-colors truncate",
                  isTodayOrActive
                    ? "text-foreground font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
                    : isMissingReflection
                    ? "text-foreground font-bold group-hover:text-amber-600 dark:group-hover:text-amber-400"
                    : isGrayedOut
                    ? "text-muted-foreground group-hover:text-foreground"
                    : "text-foreground group-hover:text-primary",
                )}
              >
                {event.name}
              </h3>

              <Badge variant="outline" className="text-muted-foreground font-normal text-xs px-1.5 py-0">
                {BIRTH_GIVING_DURATION_LABELS[event.duration]}
              </Badge>

              {isActive && (
                <Badge className="bg-emerald-600 text-white dark:bg-emerald-500 border-transparent text-xs px-2.5 py-0.5 font-semibold flex items-center gap-1.5 shadow-xs">
                  <span className="size-1.5 rounded-full bg-white animate-pulse" />
                  Právě probíhá
                </Badge>
              )}

              {!isActive && isToday && (
                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 text-xs px-2 py-0.5 font-semibold flex items-center gap-1">
                  <Clock className="size-3" />
                  Dnes v {timeStr}
                </Badge>
              )}

              {event.status === "draft" && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  Koncept
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground/80">
                <Briefcase className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate max-w-[200px]">{event.customer}</span>
              </span>

              <span>·</span>

              <span className="tabular-nums">
                {fullDateStr} v {timeStr}
              </span>

              {userTeam && (
                <>
                  <span>·</span>
                  <span className="font-medium text-foreground/90">
                    Tým: {userTeam.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right meta & badges */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3.5 shrink-0 text-muted-foreground/70" />
              <span className="tabular-nums font-medium text-foreground">{event.team_count}</span>{" "}
              {pluralizeCz(event.team_count, ["tým", "týmy", "týmů"])}
            </span>

            <span className="flex items-center gap-1">
              <Trophy className="size-3.5 shrink-0 text-muted-foreground/70" />
              <span className="tabular-nums font-medium text-foreground">{event.participant_count}</span>{" "}
              {pluralizeCz(event.participant_count, ["účastník:ice", "účastníci:ce", "účastníků:ic"])}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isParticipant && (
              <Badge variant="default" className="text-[10px] gap-1 px-2 py-0.5 font-medium">
                <UserCheck className="size-3" />
                Můj tým
              </Badge>
            )}

            {isOrganizer && !isParticipant && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-muted-foreground font-medium">
                Organizuji
              </Badge>
            )}

            <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all hidden sm:block" />
          </div>
        </div>
      </div>

      {/* Attended event: Show reflection quote if submitted */}
      {isParticipant && userReflection && (
        <div className="mt-1 flex items-start gap-2 rounded-lg border-l-2 border-primary/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <MessageSquareQuote className="size-3.5 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="font-medium text-foreground/90 line-clamp-2 italic">
              „{userReflection}“
            </p>
          </div>
        </div>
      )}

      {/* Attended concluded event: Prominently highlight missing reflection */}
      {isMissingReflection && (
        <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquarePlus className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-medium truncate">Chybí tvá reflexe z akce</span>
          </div>
          <span className="font-semibold shrink-0 text-amber-700 dark:text-amber-200 underline underline-offset-2">
            Doplnit reflexi →
          </span>
        </div>
      )}
    </Link>
  );
}