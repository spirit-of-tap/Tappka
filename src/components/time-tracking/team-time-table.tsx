"use client"

import { ChevronRight } from "lucide-react"
import { useMemo } from "react"

import { ProfileAvatar } from "@/components/profile-avatar"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { formatMetricValue } from "@/lib/metrics/config"
import { MS_PER_HOUR, PRAGUE_TIME_ZONE, TIME_DIRECTIONS, TIME_DIRECTION_LABELS } from "@/lib/time-tracking/constants"
import { entryDurationMs, formatDurationShort } from "@/lib/time-tracking/duration"
import type { TeamMember, TimeEntryWithTag, TimeRange, TimeSummary } from "@/lib/time-tracking/types"
import { groupEntriesByDay, summarize, toPragueDateKey } from "@/lib/time-tracking/week"
import { cn } from "@/lib/utils"

import { formatDayHeading } from "./cas-query"

const AVATAR_SIZE = 32
const PERCENT_MAX = 100
const COLUMN_GRID = "sm:grid-cols-[minmax(0,1fr)_repeat(4,4.75rem)_7rem]"

const clockFormatter = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: PRAGUE_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
})

const DIRECTION_DOT_CLASS = Object.fromEntries(TIME_DIRECTIONS.map((d) => [d.value, d.dotClass])) as Record<
  TimeEntryWithTag["direction"],
  string
>

export interface TeamTimeTableProps {
  members: readonly TeamMember[]
  entries: readonly TimeEntryWithTag[]
  week: TimeRange
  /** Reference time for running timers (pass the server's `new Date()`). */
  now: Date
  weeklyTargetHours: number
}

interface MemberRow {
  member: TeamMember
  entries: TimeEntryWithTag[]
  summary: TimeSummary
  isRunning: boolean
}

function formatHours(ms: number): string {
  return formatMetricValue(ms / MS_PER_HOUR, "hours")
}

export function buildMemberRows(
  members: readonly TeamMember[],
  entries: readonly TimeEntryWithTag[],
  week: TimeRange,
  now: Date,
): MemberRow[] {
  const byMember = new Map<string, TimeEntryWithTag[]>()
  for (const entry of entries) {
    const bucket = byMember.get(entry.profile_id)
    if (bucket) bucket.push(entry)
    else byMember.set(entry.profile_id, [entry])
  }

  return members
    .map((member) => {
      const memberEntries = byMember.get(member.id) ?? []
      return {
        member,
        entries: memberEntries,
        summary: summarize(memberEntries, { includeRunning: true, now, range: week }),
        isRunning: memberEntries.some((entry) => entry.ended_at === null),
      }
    })
    .sort((a, b) => b.summary.totalMs - a.summary.totalMs || a.member.name.localeCompare(b.member.name, "cs"))
}

export function TeamTimeTable({ members, entries, week, now, weeklyTargetHours }: TeamTimeTableProps) {
  const rows = useMemo(() => buildMemberRows(members, entries, week, now), [members, entries, week, now])

  const teamTotals = useMemo(() => summarize(entries, { includeRunning: true, now, range: week }), [entries, now, week])
  const averageMs = rows.length > 0 ? teamTotals.totalMs / rows.length : 0

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div
        aria-hidden
        className={cn(
          "hidden items-center gap-x-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid",
          COLUMN_GRID,
        )}
      >
        <span className="pl-6">Člen:ka</span>
        {TIME_DIRECTIONS.map((direction) => (
          <span key={direction.value} className="text-right">
            {direction.label}
          </span>
        ))}
        <span className="text-right">Celkem</span>
        <span>Cíl {formatMetricValue(weeklyTargetHours, "hours")}</span>
      </div>

      <ul className="divide-y">
        {rows.map((row) => (
          <li key={row.member.id}>
            <MemberTimeRow row={row} now={now} weeklyTargetHours={weeklyTargetHours} />
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t bg-muted/40 px-4 py-3 text-sm",
          COLUMN_GRID,
        )}
      >
        <span className="font-medium sm:pl-6">Tým celkem</span>
        {TIME_DIRECTIONS.map((direction) => (
          <span key={direction.value} className="hidden text-right tabular-nums text-muted-foreground sm:block">
            {formatHours(teamTotals.byDirection[direction.value])}
          </span>
        ))}
        <span className="text-right font-semibold tabular-nums" data-testid="team-total">
          {formatHours(teamTotals.totalMs)}
        </span>
        <span className="col-span-2 text-xs text-muted-foreground sm:col-span-1" data-testid="team-average">
          Průměr na osobu <span className="font-medium tabular-nums text-foreground">{formatHours(averageMs)}</span>
        </span>
      </div>
    </div>
  )
}

interface MemberTimeRowProps {
  row: MemberRow
  now: Date
  weeklyTargetHours: number
}

function MemberTimeRow({ row, now, weeklyTargetHours }: MemberTimeRowProps) {
  const { member, summary, isRunning } = row
  const targetMs = weeklyTargetHours * MS_PER_HOUR
  const percent = targetMs > 0 ? Math.min(PERCENT_MAX, (summary.totalMs / targetMs) * PERCENT_MAX) : 0
  const isGoalReached = targetMs > 0 && summary.totalMs >= targetMs

  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-left text-sm",
          "transition-colors hover:bg-accent focus-ring",
          COLUMN_GRID,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
          />
          <ProfileAvatar picture={member.picture} name={member.name} size={AVATAR_SIZE} />
          <span className="min-w-0 truncate font-medium">{member.name}</span>
          {isRunning && <RunningIndicator />}
        </span>

        {TIME_DIRECTIONS.map((direction) => (
          <span key={direction.value} className="hidden text-right tabular-nums text-muted-foreground sm:block">
            {formatHours(summary.byDirection[direction.value])}
          </span>
        ))}

        <span className="text-right font-semibold tabular-nums">{formatHours(summary.totalMs)}</span>

        <Progress
          value={percent}
          aria-label={`${member.name}: ${formatHours(summary.totalMs)} z ${formatMetricValue(weeklyTargetHours, "hours")}`}
          className="col-span-2 h-1.5 bg-muted/80 sm:col-span-1"
          indicatorClassName={isGoalReached ? "bg-success" : "bg-foreground/75"}
        />

        <span className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:hidden">
          {TIME_DIRECTIONS.map((direction) => (
            <span key={direction.value} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", direction.dotClass)} />
              {direction.label}
              <span className="font-medium tabular-nums text-foreground">
                {formatHours(summary.byDirection[direction.value])}
              </span>
            </span>
          ))}
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t bg-muted/20 px-4 py-3 sm:pl-14">
        <MemberEntries entries={row.entries} now={now} />
      </CollapsibleContent>
    </Collapsible>
  )
}

function RunningIndicator() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success-strong">
      <span aria-hidden className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      běží
    </span>
  )
}

function MemberEntries({ entries, now }: { entries: readonly TimeEntryWithTag[]; now: Date }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Tento týden bez záznamů.</p>
  }

  return (
    <div className="space-y-3">
      {groupEntriesByDay(entries).map((day) => (
        <section key={day.dateKey} className="space-y-1.5">
          <h3 className="text-xs font-medium capitalize text-muted-foreground">{formatDayHeading(day.dateKey)}</h3>
          <ul className="space-y-1.5">
            {day.entries.map((entry) => (
              <EntryLine key={entry.id} entry={entry} now={now} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function EntryLine({ entry, now }: { entry: TimeEntryWithTag; now: Date }) {
  const isRunning = entry.ended_at === null
  const start = new Date(entry.started_at)
  const end = entry.ended_at === null ? null : new Date(entry.ended_at)
  const endsNextDay = end !== null && toPragueDateKey(end) !== toPragueDateKey(start)

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DIRECTION_DOT_CLASS[entry.direction])} />
      <span className="min-w-0 truncate">{entry.title ?? TIME_DIRECTION_LABELS[entry.direction]}</span>
      {entry.tag && (
        <Badge variant="outline" className="bg-muted/60 font-normal">
          {entry.tag.name}
        </Badge>
      )}
      <span className="ml-auto flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
        <span>
          {clockFormatter.format(start)}–{end ? clockFormatter.format(end) : "běží"}
          {endsNextDay && " (→ následující den)"}
        </span>
        <span className={cn("font-medium text-foreground", isRunning && "text-success-strong")}>
          {formatDurationShort(entryDurationMs(entry, now))}
        </span>
      </span>
    </li>
  )
}
