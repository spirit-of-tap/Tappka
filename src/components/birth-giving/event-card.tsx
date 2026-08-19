import Link from "next/link";
import { CalendarClock, Timer, Users, UserRound } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BirthGivingEventStatusBadge } from "./event-status-badge";
import { getEventTimeState } from "@/lib/birth-giving/time";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";
import type { BirthGivingEventIndexItem } from "@/lib/birth-giving/types";

interface BirthGivingEventCardProps {
  event: BirthGivingEventIndexItem;
  now: string;
}

export function BirthGivingEventCard({ event, now }: BirthGivingEventCardProps) {
  const startsAt = new Date(event.starts_at);
  const timeState = getEventTimeState(startsAt, event.duration, new Date(now));

  return (
    <Link href={`/birth-giving/${event.id}`} className="block rounded-xl focus-ring">
      <Card className="p-3 transition-colors hover:bg-accent/50 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{event.name}</span>
              <BirthGivingEventStatusBadge
                joiningOpen={event.joining_open}
                timeState={timeState}
              />
              <Badge variant="outline" className="text-muted-foreground">
                {BIRTH_GIVING_DURATION_LABELS[event.duration]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{event.customer}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <CalendarClock className="size-3" />
                {startsAt.toLocaleDateString("cs-CZ", {
                  day: "numeric",
                  month: "numeric",
                  year: "numeric",
                })}{" "}
                {startsAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Users className="size-3" />
                {event.minimum_team_size}–{event.maximum_team_size}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <UserRound className="size-3" />
                <span className="tabular-nums">{event.team_count}</span>
                {pluralizeCz(event.team_count, ["tým", "týmy", "týmů"])}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Timer className="size-3" />
                <span className="tabular-nums">{event.participant_count}</span>
                {pluralizeCz(event.participant_count, ["účast", "účasti", "účastí"])}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}