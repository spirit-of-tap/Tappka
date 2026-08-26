import { CheckCircle2, FileWarning, MessageSquareText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BirthGivingTeamDetail } from "@/lib/birth-giving/types";

interface BirthGivingTeamReadinessBadgeProps {
  team: BirthGivingTeamDetail;
}

export function BirthGivingTeamReadinessBadge({ team }: BirthGivingTeamReadinessBadgeProps) {
  const resultsReady = team.result_state === "present" && team.result_files.length > 0;
  const resultsMissing = team.result_state === "missing";
  const reflectionsDone = team.members.filter(
    (member) => member.reflection_contribution || member.reflection_learning,
  ).length;
  const reflectionsTotal = team.members.length;
  const reflectionsReady = reflectionsTotal > 0 && reflectionsDone === reflectionsTotal;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span
        className={cn(
          "flex items-center gap-1",
          resultsReady && "text-success-strong",
          resultsMissing && "text-warning-strong",
        )}
        title={
          resultsReady
            ? "Výsledky nahrány"
            : resultsMissing
              ? "Výsledek nedohledán"
              : "Výsledky zatím chybí"
        }
      >
        {resultsReady ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <FileWarning className="size-3.5" />
        )}
        Výsledky
      </span>
      <span
        className={cn("flex items-center gap-1", reflectionsReady && "text-success-strong")}
        title="Dokončené reflexe"
      >
        <MessageSquareText className="size-3.5" />
        <span className="tabular-nums">
          {reflectionsDone}/{reflectionsTotal}
        </span>
        reflexí
      </span>
    </div>
  );
}
