"use client"

import { ChartColumn } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { StatsPerson, StatsSession } from "@/lib/training-sessions/stats"

import { AttendanceSection } from "./attendance-section"
import { FacilitationSection } from "./facilitation-section"
import { PreparationSection } from "./preparation-section"

export interface TsStatsViewProps {
  teamName: string
  rangeLabel: string
  fileNamePrefix: string
  members: StatsPerson[]
  /** Already filtered to sessions that started (and were not cancelled). */
  sessions: StatsSession[]
  showAttendance: boolean
}

export function TsStatsView({ teamName, rangeLabel, fileNamePrefix, members, sessions, showAttendance }: TsStatsViewProps) {
  if (sessions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartColumn className="size-6" />
          </EmptyMedia>
          <EmptyTitle>V tomhle období zatím žádné TS neproběhlo</EmptyTitle>
          <EmptyDescription>Statistiky se objeví po prvním TS. Zkus delší období.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const subtitle = [teamName, rangeLabel].filter(Boolean).join(" · ")
  const shared = { sessions, subtitle, fileNamePrefix }
  return (
    <div className="space-y-10">
      <FacilitationSection {...shared} members={members} />
      <PreparationSection {...shared} />
      <AttendanceSection {...shared} members={members} visible={showAttendance} />
    </div>
  )
}
