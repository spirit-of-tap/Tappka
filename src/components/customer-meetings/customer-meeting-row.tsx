import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { getMeetingLoop, LOOP_LABELS, type MeetingLoop } from "@/lib/customer-meetings/status"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

const CHIP_CLASS: Record<MeetingLoop, string> = {
  "missing-follow-up": "border-transparent bg-warning/10 text-warning-strong",
  undated: "",
}

function formatDay(dateStr: string): string {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric" }).format(new Date(dateStr))
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0]!)
    .join("")
    .toUpperCase()
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
 * One timeline entry: initials disc on the rail, a fixed-width day column
 * (so names align vertically), then person · company on one line.
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
      <span
        aria-hidden
        className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        {initialsFromName(meeting.contact_person)}
      </span>
      {/* Day-first timestamp column — fixed width so names align vertically. */}
      {meeting.meeting_at && (
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {formatDay(meeting.meeting_at)}
        </span>
      )}
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
