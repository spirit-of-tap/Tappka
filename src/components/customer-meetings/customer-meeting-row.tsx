import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { getMeetingLoop, LOOP_LABELS, type MeetingLoop } from "@/lib/customer-meetings/status"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

const CHIP_CLASS: Record<MeetingLoop, string> = {
  "missing-follow-up": "border-transparent bg-warning/10 text-warning-strong",
  undated: "",
}

/** Day-of-month for the timeline disc — plain number, no period. */
function dayOfMonth(dateStr: string): string {
  return String(new Date(dateStr).getDate())
}

interface CustomerMeetingRowProps {
  meeting: Pick<
    CustomerMeeting,
    "id" | "company" | "contact_person" | "meeting_at" | "post_mortem"
  >
  /** Injectable for tests. */
  now?: Date
  /** False inside the "Bez data" section, whose header already says it. */
  showUndatedChip?: boolean
}

/**
 * One timeline entry: the disc on the rail carries the day-of-month (the
 * month header supplies the month), then person · company on one line.
 * Chip only for open loops. Whole row links to detail (~44px tap target).
 */
export function CustomerMeetingRow({
  meeting,
  now,
  showUndatedChip = true,
}: CustomerMeetingRowProps) {
  const loop = getMeetingLoop(meeting)
  // Inside the "Bez data" group the header already says it — a per-row chip
  // would repeat the loudest possible information.
  const visibleLoop = showUndatedChip ? loop : loop === "undated" ? null : loop

  return (
    <Link
      href={`/schuzky/${meeting.id}`}
      className="focus-ring relative flex items-center gap-3 rounded-lg py-2 pr-1 transition-colors hover:bg-accent/50"
    >
      {/* The disc IS the date — the month header gives the month context. */}
      <span
        className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground"
        aria-hidden={meeting.meeting_at ? undefined : true}
      >
        {meeting.meeting_at ? dayOfMonth(meeting.meeting_at) : "–"}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="font-medium">{meeting.contact_person}</span>
        <span className="text-muted-foreground"> · {meeting.company}</span>
      </p>
      {visibleLoop && (
        <Badge
          variant="outline"
          className={`ml-auto shrink-0 ${CHIP_CLASS[visibleLoop]}`}
        >
          {LOOP_LABELS[visibleLoop]}
        </Badge>
      )}
    </Link>
  )
}
