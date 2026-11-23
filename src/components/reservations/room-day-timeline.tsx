import { cn } from "@/lib/utils";
import {
  getTimelineSegments,
  TIMELINE_END_HOUR,
  TIMELINE_START_HOUR,
  timelinePercent,
} from "@/lib/reservations/room-map";
import { formatTime } from "@/lib/reservations/utils";
import type { Reservation } from "@/lib/reservations/types";

const LABEL_EVERY_HOURS = 2;
/** Block widths (in % of the day) from which it carries its full range, or just its start time. */
const RANGE_LABEL_WIDTH = 24;
const START_LABEL_WIDTH = 9;

const TICK_TEXT = "text-[10px]";
const SEGMENT_TEXT = "text-[11px]";

const HOURS = Array.from(
  { length: TIMELINE_END_HOUR - TIMELINE_START_HOUR + 1 },
  (_, i) => TIMELINE_START_HOUR + i,
);

interface RoomDayTimelineProps {
  roomId: string;
  day: Date;
  reservations: Reservation[];
  mineIds?: ReadonlySet<string>;
  isToday: boolean;
  chosen: { start: Date; end: Date } | null;
  now?: Date;
}

export function RoomDayTimeline({
  roomId,
  day,
  reservations,
  mineIds,
  isToday,
  chosen,
  now = new Date(),
}: RoomDayTimelineProps) {
  const segments = getTimelineSegments(reservations, roomId, day, mineIds);
  const nowPercent = isToday ? timelinePercent(now, day) : null;
  const showNow = nowPercent !== null && nowPercent > 0 && nowPercent < 100;
  const chosenLeft = chosen ? timelinePercent(chosen.start, day) : 0;
  const chosenWidth = chosen ? timelinePercent(chosen.end, day) - chosenLeft : 0;

  const summary =
    segments.length === 0
      ? `Celý den volno (${TIMELINE_START_HOUR}–${TIMELINE_END_HOUR} h)`
      : `Obsazeno ${segments.map((s) => `${formatTime(s.start)}–${formatTime(s.end)}${s.mine ? " (tvoje)" : ""}`).join(", ")}`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-chart-3-strong">Den v místnosti</h4>
        <span className="text-xs text-muted-foreground">
          {TIMELINE_START_HOUR}:00–{TIMELINE_END_HOUR}:00
        </span>
      </div>

      <div className={cn("relative", showNow && "pt-5")}>
        {showNow && (
          <span
            aria-hidden
            className={cn("absolute top-0 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 font-bold leading-none text-background tabular-nums", TICK_TEXT)}
            style={{ left: `${nowPercent}%` }}
          >
            {formatTime(now)}
          </span>
        )}

        <div aria-hidden className="relative h-11 overflow-hidden rounded-xl bg-success/12 ring-1 ring-inset ring-success/20">
          {showNow && (
            <span
              className="absolute inset-y-0 left-0 bg-muted/90"
              style={{ width: `${nowPercent}%` }}
            />
          )}

          {HOURS.slice(1, -1).map((hour) => (
            <span
              key={hour}
              className={cn(
                "absolute inset-y-0 w-px",
                hour % LABEL_EVERY_HOURS === 1 ? "bg-foreground/15" : "bg-foreground/7",
              )}
              style={{ left: `${timelinePercent(new Date(new Date(day).setHours(hour, 0, 0, 0)), day)}%` }}
            />
          ))}

          {segments.map((segment) => (
            <span
              key={segment.id}
              className={cn(
                "absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-lg px-1 font-semibold whitespace-nowrap tabular-nums",
                SEGMENT_TEXT,
                segment.mine ? "bg-primary text-primary-foreground" : "bg-chart-2 text-warning-foreground",
              )}
              style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
            >
              {segment.width >= RANGE_LABEL_WIDTH
                ? `${formatTime(segment.start)}–${formatTime(segment.end)}`
                : segment.width >= START_LABEL_WIDTH && formatTime(segment.start)}
            </span>
          ))}

          {chosen && chosenWidth > 0 && (
            <span
              className="absolute inset-y-0.5 rounded-lg border-2 border-chart-3 bg-chart-3/20 motion-safe:transition-[left,width] motion-safe:duration-500 motion-safe:ease-smooth"
              style={{ left: `${chosenLeft}%`, width: `${chosenWidth}%` }}
            />
          )}

          {showNow && (
            <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={{ left: `${nowPercent}%` }} />
          )}
        </div>

        <div aria-hidden className={cn("relative mt-1 h-4 text-muted-foreground tabular-nums", TICK_TEXT)}>
          {HOURS.filter((hour) => (hour - TIMELINE_START_HOUR) % LABEL_EVERY_HOURS === 0).map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2 first:translate-x-0"
              style={{ left: `${timelinePercent(new Date(new Date(day).setHours(hour, 0, 0, 0)), day)}%` }}
            >
              {hour}
            </span>
          ))}
        </div>
      </div>

      <ul aria-hidden className={cn("flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground", SEGMENT_TEXT)}>
        <LegendItem className="bg-success/30 ring-1 ring-inset ring-success/40">volno</LegendItem>
        <LegendItem className="bg-chart-2">obsazeno</LegendItem>
        <LegendItem className="bg-primary">tvoje</LegendItem>
        <LegendItem className="border-2 border-chart-3 bg-chart-3/20">vybraný čas</LegendItem>
        {showNow && <LegendItem className="bg-muted ring-1 ring-inset ring-border">uplynulo</LegendItem>}
      </ul>

      <p className="text-xs text-muted-foreground">{summary}</p>
    </div>
  );
}

function LegendItem({ className, children }: { className: string; children: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-sm", className)} />
      {children}
    </li>
  );
}
