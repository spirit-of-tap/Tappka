import { MessageSquareText, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

interface BirthGivingEventOverviewStripProps {
  event: BirthGivingEventDetail;
}

export function BirthGivingEventOverviewStrip({ event }: BirthGivingEventOverviewStripProps) {
  const teams = event.teams.filter((team) => !team.cancelled_at);
  const reflectionsDone = teams.reduce(
    (sum, team) =>
      sum +
      team.members.filter(
        (member) => member.reflection_contribution || member.reflection_learning,
      ).length,
    0,
  );
  const reflectionsTotal = teams.reduce((sum, team) => sum + team.members.length, 0);

  if (teams.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <UsersRound className="size-3" />
        {teams.length} {pluralizeCz(teams.length, ["tým", "týmy", "týmů"])}
      </Badge>
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <MessageSquareText className="size-3" />
        {reflectionsDone}/{reflectionsTotal} reflexí
      </Badge>
    </div>
  );
}

