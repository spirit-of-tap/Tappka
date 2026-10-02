import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
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
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="space-y-6">
      {groupByPragueDay(sessions, (s) => s.starts_at).map((group) => (
        <section key={group.dateKey} aria-labelledby={`day-${group.dateKey}`} className="space-y-2">
          <h2 id={`day-${group.dateKey}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.heading}
          </h2>
          <div className="space-y-2">
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
