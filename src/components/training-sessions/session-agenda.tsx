import { CalendarDays } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { findConflicts } from "@/lib/training-sessions/conflicts"
import { groupByPragueDay } from "@/lib/training-sessions/format"
import { toTiming, type SessionTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"

import { SessionCard, type SessionViewer } from "./session-card"

interface SessionAgendaProps {
  sessions: TrainingSessionListItem[]
  viewer: SessionViewer
  commitments: SessionTiming[]
  now: string
  emptyTitle: string
  emptyDescription: string
}

export function SessionAgenda({ sessions, viewer, commitments, now, emptyTitle, emptyDescription }: SessionAgendaProps) {
  if (sessions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays className="size-6 text-muted-foreground" aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="space-y-6">
      {groupByPragueDay(sessions, (s) => s.starts_at).map((group) => (
        <section key={group.dateKey} aria-labelledby={`day-${group.dateKey}`} className="space-y-2.5">
          <div className="flex items-center gap-2 pt-1">
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <h2 id={`day-${group.dateKey}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {group.heading}
            </h2>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="space-y-2.5">
            {group.items.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                viewer={viewer}
                conflicts={findConflicts(toTiming(session), commitments)}
                now={now}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

