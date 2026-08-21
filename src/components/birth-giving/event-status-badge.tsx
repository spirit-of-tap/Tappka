import { Badge } from "@/components/ui/badge";
import type { BirthGivingTimeState } from "@/lib/birth-giving/time";

export interface BirthGivingEventStatusBadgeProps {
  joiningOpen: boolean;
  timeState: BirthGivingTimeState;
}

export function BirthGivingEventStatusBadge({
  joiningOpen,
  timeState,
}: BirthGivingEventStatusBadgeProps) {
  if (timeState === "ended") return <Badge variant="secondary">Ukončeno</Badge>;
  if (timeState === "active") {
    return (
      <Badge variant="outline" className="bg-chart-3/10 text-chart-3-strong dark:bg-chart-3/15">
        Probíhá
      </Badge>
    );
  }
  if (joiningOpen) {
    return (
      <Badge
        variant="outline"
        className="border-success/30 bg-success/10 text-success-strong dark:bg-success/15"
      >
        Přihlašování otevřeno
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Přihlašování zavřeno
    </Badge>
  );
}