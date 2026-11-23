import { CalendarCheck, DoorOpen } from "lucide-react";
import type { ReactNode } from "react";

interface ReservationsSummaryProps {
  upcomingThisWeek: number;
  freeRooms: number;
  totalRooms: number;
}

export function ReservationsSummary({
  upcomingThisWeek,
  freeRooms,
  totalRooms,
}: ReservationsSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <SummaryTile
        icon={<CalendarCheck className="size-5" />}
        value={upcomingThisWeek}
        label="tvých rezervací tento týden"
        delay={0}
      />
      <SummaryTile
        icon={<DoorOpen className="size-5" />}
        value={`${freeRooms}/${totalRooms}`}
        label="volných místností teď"
        delay={60}
      />
    </div>
  );
}

function SummaryTile({
  icon,
  value,
  label,
  delay,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  delay: number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl bg-chart-3/10 px-4 py-3 text-chart-3-strong motion-safe:animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-chart-3/15">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-heading text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-xs leading-tight">{label}</p>
      </div>
    </div>
  );
}
