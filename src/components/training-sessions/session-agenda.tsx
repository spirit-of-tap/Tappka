import { CalendarDays } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { findConflicts } from "@/lib/training-sessions/conflicts"
import { groupByPragueDay } from "@/lib/training-sessions/format"
import { toTiming, type SessionTiming, type TrainingSessionListItem } from "@/lib/training-sessions/types"

import { SessionCard, type SessionViewer } from "./session-card"

const STAGGER_MS = 50
const STAGGER_MAX = 8

interface SessionAgendaProps {
  sessions: TrainingSessionListItem[]
  viewer: SessionViewer
  commitments: SessionTiming[]
  now: string
  emptyTitle: string
  emptyDescription: string
  showLocation?: boolean
  showPreparation?: boolean
  featureFirst?: boolean
}

export function SessionAgenda({
  sessions,
  viewer,
  commitments,
  now,
  emptyTitle,
  emptyDescription,
  showLocation,
  showPreparation,
  featureFirst = false,
}: SessionAgendaProps) {
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
  let position = 0
  return (
    <div className="space-y-6">
      {groupByPragueDay(sessions, (s) => s.starts_at).map((group) => (
        <section key={group.dateKey} aria-labelledby={`day-${group.dateKey}`} className="space-y-2.5">
          <div className="flex items-center gap-3 pt-1">
            <h2 id={`day-${group.dateKey}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.heading}
            </h2>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="space-y-3">
            {group.items.map((session) => {
              const index = position++
              return (
                <div
                  key={session.id}
                  className="motion-safe:animate-rise"
                  style={{ animationDelay: `${Math.min(index, STAGGER_MAX) * STAGGER_MS}ms` }}
                >
                  <SessionCard
                    session={session}
                    viewer={viewer}
                    conflicts={findConflicts(toTiming(session), commitments)}
                    now={now}
                    showLocation={showLocation}
                    showPreparation={showPreparation}
                    featured={featureFirst && index === 0}
                  />
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
