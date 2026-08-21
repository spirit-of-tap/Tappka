import { Building2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getMeetingLoop, LOOP_LABELS, type MeetingLoop } from "@/lib/customer-meetings/status"
import type { CustomerMeeting } from "@/lib/customer-meetings/types"

const CHIP_CLASS: Record<MeetingLoop, string> = {
  planned: "",
  "missing-follow-up": "border-transparent bg-warning/10 text-warning-strong",
  undated: "",
}

function formatDayMonth(dateStr: string): string {
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric" }).format(
    new Date(dateStr),
  )
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

interface CustomerMeetingCardProps {
  meeting: Pick<CustomerMeeting, "company" | "contact_person" | "meeting_at" | "post_mortem">
  /** Injectable for tests. */
  now?: Date
}

export function CustomerMeetingCard({ meeting, now }: CustomerMeetingCardProps) {
  const loop = getMeetingLoop(meeting, now)

  return (
    <Card className="space-y-1.5 p-3 transition-colors sm:p-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          {initialsFromName(meeting.contact_person)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{meeting.contact_person}</span>
        {loop && (
          <Badge
            variant={loop === "missing-follow-up" ? "outline" : "default"}
            className={`shrink-0 ${CHIP_CLASS[loop]}`}
          >
            {LOOP_LABELS[loop]}
          </Badge>
        )}
      </div>
      <p className="flex items-center gap-1.5 pl-9.5 text-xs text-muted-foreground">
        <Building2 aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{meeting.company}</span>
        {meeting.meeting_at && (
          <span className="shrink-0 tabular-nums">· {formatDayMonth(meeting.meeting_at)}</span>
        )}
      </p>
    </Card>
  )
}
