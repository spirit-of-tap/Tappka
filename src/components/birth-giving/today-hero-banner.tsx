import Link from "next/link";
import { ArrowRight, Sparkles, UserCheck, Briefcase, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import { getEventTimeState } from "@/lib/birth-giving/time";
import type { BirthGivingEventIndexItem } from "@/lib/birth-giving/types";

interface TodayHeroBannerProps {
  event: BirthGivingEventIndexItem;
  profileId: string;
  now: string;
}

export function TodayHeroBanner({ event, profileId, now }: TodayHeroBannerProps) {
  const startsAt = new Date(event.starts_at);
  const timeState = getEventTimeState(startsAt, event.duration, new Date(now));
  const isParticipant = event.participant_profile_ids?.includes(profileId);
  const isOrganizer = event.organizer_profile_ids?.includes(profileId);

  const userTeam = event.teams?.find((t) =>
    t.members?.some((m) => m.profile_id === profileId),
  );

  const isActive = timeState === "active";
  const startsAtTime = startsAt.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/5 to-card p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <Badge className="bg-emerald-500 text-white dark:bg-emerald-600 border-transparent text-xs px-2.5 py-0.5 font-medium flex items-center gap-1.5 shadow-xs">
              <span className="size-2 rounded-full bg-white animate-pulse" />
              Dnes probíhá
            </Badge>
          ) : (
            <Badge className="bg-primary/20 text-primary border-primary/30 text-xs px-2.5 py-0.5 font-medium flex items-center gap-1.5">
              <Clock className="size-3" />
              Začíná dnes v {startsAtTime}
            </Badge>
          )}

          <Badge variant="outline" className="text-muted-foreground font-medium text-xs">
            {BIRTH_GIVING_DURATION_LABELS[event.duration]}
          </Badge>

          <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <Briefcase className="size-3.5" />
            {event.customer}
          </span>
        </div>

        {isParticipant && (
          <Badge variant="default" className="gap-1 text-xs px-2.5 py-0.5 font-medium">
            <UserCheck className="size-3.5" />
            {userTeam ? `Můj tým: ${userTeam.name}` : "Můj tým"}
          </Badge>
        )}

        {isOrganizer && !isParticipant && (
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 text-muted-foreground font-medium">
            Organizuji
          </Badge>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {event.name}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isActive
              ? "Zadání a týmové odevzdávání jsou právě otevřené."
              : `Připrav se na start akce v ${startsAtTime}.`}
          </p>
        </div>

        <Button asChild size="default" className="gap-2 shrink-0 h-10 px-4 font-semibold shadow-xs">
          <Link href={`/birth-giving/${event.id}`}>
            <Sparkles className="size-4" />
            Přejít na zadání a tým
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
