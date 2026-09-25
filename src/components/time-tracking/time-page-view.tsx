"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Clock, FilterX, Plus } from "lucide-react"

import { MetricProgress } from "@/components/metrics/metric-progress"
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { METRICS, METRIC_PERIOD_LABELS } from "@/lib/metrics/config"
import { MS_PER_HOUR, TIME_DIRECTIONS, TIME_DIRECTION_VALUES } from "@/lib/time-tracking/constants"
import { entryDurationMs, formatDurationShort } from "@/lib/time-tracking/duration"
import type { TimeDirection, TimeEntryWithTag, TimeRange, TimeTag } from "@/lib/time-tracking/types"
import { getWeekRange, groupEntriesByDay, summarize } from "@/lib/time-tracking/week"
import { cn } from "@/lib/utils"
import { pluralizeCz } from "@/lib/utils/pluralize-cz"

import { formatDayHeading, formatWeekLabel } from "./cas-query"
import { DirectionSummary } from "./direction-summary"
import { EntryFormDialog } from "./entry-form-dialog"
import { RunningEntryRow, TimeEntryRow } from "./time-entry-row"
import { useOptionalTimer } from "./timer-provider"
import { WeekNav } from "./week-nav"

export const DIRECTION_PARAM = "direction"
export const TAG_PARAM = "tag"

const ALL_TAGS_VALUE = "__all__"
const ALL_TAGS_LABEL = "Všechny tagy"
const CREATE_LABEL = "Zapsat ručně"
const EMPTY_DESCRIPTION = "Zatím žádný záznam. Spusť časomíru nebo zapiš čas ručně."

export interface TimePageViewProps {
  entries: TimeEntryWithTag[]
  tags: TimeTag[]
  /** Displayed week (`to` exclusive). */
  week: TimeRange
  /** Server render time. */
  now: Date
  profileId: string
}

interface DialogState {
  entry: TimeEntryWithTag | null
  now: Date
}

function parseDirection(value: string | null): TimeDirection | null {
  return value !== null && (TIME_DIRECTION_VALUES as readonly string[]).includes(value)
    ? (value as TimeDirection)
    : null
}

function sortNewestFirst(entries: TimeEntryWithTag[]): TimeEntryWithTag[] {
  return [...entries].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
}

export function TimePageView({ entries, tags, week, now, profileId }: TimePageViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timer = useOptionalTimer()

  // Local copy for optimistic updates; adopt fresh server data after router.refresh().
  const [items, setItems] = React.useState(entries)
  const [prevEntries, setPrevEntries] = React.useState(entries)
  if (entries !== prevEntries) {
    setPrevEntries(entries)
    setItems(entries)
  }

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialog, setDialog] = React.useState<DialogState | null>(null)

  const directionFilter = parseDirection(searchParams.get(DIRECTION_PARAM))
  const tagFilter = searchParams.get(TAG_PARAM)
  const hasFilter = directionFilter !== null || tagFilter !== null

  // The running timer comes from the provider (live); fall back to server data outside it.
  const serverRunning = items.find((entry) => entry.ended_at === null) ?? null
  const running = timer ? timer.active : serverRunning
  const liveNowMs = running
    ? Date.parse(running.started_at) + (timer ? timer.elapsedMs : Math.max(0, now.getTime() - Date.parse(running.started_at)))
    : now.getTime()
  const runningInWeek =
    running !== null &&
    running.profile_id === profileId &&
    Date.parse(running.started_at) < week.to.getTime() &&
    liveNowMs > week.from.getTime()
      ? running
      : null

  const closed = React.useMemo(() => items.filter((entry) => entry.ended_at !== null), [items])

  const summary = summarize(runningInWeek ? [...closed, runningInWeek] : closed, {
    includeRunning: true,
    now: new Date(liveNowMs),
    range: week,
  })

  const matchesFilter = React.useCallback(
    (entry: TimeEntryWithTag) =>
      (directionFilter === null || entry.direction === directionFilter) &&
      (tagFilter === null || entry.tag_id === tagFilter),
    [directionFilter, tagFilter],
  )

  const days = React.useMemo(() => groupEntriesByDay(closed.filter(matchesFilter)), [closed, matchesFilter])
  const showRunning = runningInWeek !== null && matchesFilter(runningInWeek)

  const totalCount = closed.length + (runningInWeek ? 1 : 0)
  const isCurrentWeek = week.from.getTime() === getWeekRange(now).from.getTime()

  function setFilterParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null) params.delete(key)
    else params.set(key, value)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(DIRECTION_PARAM)
    params.delete(TAG_PARAM)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function openCreate() {
    setDialog({ entry: null, now: new Date() })
    setDialogOpen(true)
  }

  function openEdit(entry: TimeEntryWithTag) {
    setDialog({ entry, now: new Date() })
    setDialogOpen(true)
  }

  function handleSaved(saved: TimeEntryWithTag) {
    setItems((current) => {
      const exists = current.some((entry) => entry.id === saved.id)
      return sortNewestFirst(
        exists ? current.map((entry) => (entry.id === saved.id ? saved : entry)) : [saved, ...current],
      )
    })
  }

  function handleDeleted(id: string) {
    setItems((current) => current.filter((entry) => entry.id !== id))
  }

  function handleDeleteFailed(entry: TimeEntryWithTag) {
    setItems((current) => (current.some((e) => e.id === entry.id) ? current : sortNewestFirst([entry, ...current])))
  }

  const hasAny = totalCount > 0
  const hasVisible = showRunning || days.length > 0

  return (
    <>
      <PageHeader
        title="Čas"
        description="Kolik času věnuješ Training, Reading a Practise"
        count={{ value: totalCount, label: pluralizeCz(totalCount, ["záznam", "záznamy", "záznamů"]) }}
        action={
          <Button size="sm" className="hidden sm:inline-flex" onClick={openCreate}>
            <Plus className="size-4" />
            {CREATE_LABEL}
          </Button>
        }
      />

      <WeekNav week={week} now={now} />

      <MetricProgress
        period="week"
        unit="hours"
        goals={[
          {
            current: summary.totalMs / MS_PER_HOUR,
            target: METRICS["time-weekly"].target,
            label: isCurrentWeek ? METRIC_PERIOD_LABELS.week : formatWeekLabel(week),
          },
        ]}
      />

      <DirectionSummary byDirection={summary.byDirection} />

      {(hasAny || hasFilter) && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtry">
          {TIME_DIRECTIONS.map((direction) => {
            const active = directionFilter === direction.value
            return (
              <Button
                key={direction.value}
                type="button"
                size="sm"
                variant={active ? "secondary" : "outline"}
                aria-pressed={active}
                className="rounded-full"
                onClick={() => setFilterParam(DIRECTION_PARAM, active ? null : direction.value)}
              >
                <span aria-hidden className={cn("size-2 rounded-full", direction.dotClass)} />
                {direction.label}
              </Button>
            )
          })}
          <Select
            value={tagFilter ?? ALL_TAGS_VALUE}
            onValueChange={(value) => setFilterParam(TAG_PARAM, value === ALL_TAGS_VALUE ? null : value)}
          >
            <SelectTrigger size="sm" className="w-auto min-w-36 sm:ml-auto" aria-label="Filtr podle tagu">
              <SelectValue placeholder={ALL_TAGS_LABEL} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS_VALUE}>{ALL_TAGS_LABEL}</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!hasAny ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Clock className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{isCurrentWeek ? "Tento týden zatím prázdno" : "V tomhle týdnu prázdno"}</EmptyTitle>
            <EmptyDescription>{EMPTY_DESCRIPTION}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              {CREATE_LABEL}
            </Button>
          </EmptyContent>
        </Empty>
      ) : !hasVisible ? (
        <Empty>
          <EmptyMedia variant="icon">
            <FilterX className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nic neodpovídá filtru</EmptyTitle>
            <EmptyDescription>Zkus jiný směr nebo tag.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Zrušit filtry
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-5">
          {showRunning && runningInWeek && (
            <RunningEntryRow
              entry={runningInWeek}
              elapsedMs={liveNowMs - Date.parse(runningInWeek.started_at)}
              isPending={timer?.isPending}
              onStop={() => timer?.openStopSheet()}
            />
          )}
          {days.map((day) => {
            const dayTotal = day.entries.reduce((sum, entry) => sum + entryDurationMs(entry), 0)
            return (
              <section key={day.dateKey} aria-labelledby={`day-${day.dateKey}`} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 px-2">
                  <h2 id={`day-${day.dateKey}`} className="text-sm font-semibold capitalize">
                    {formatDayHeading(day.dateKey)}
                  </h2>
                  <span className="text-xs tabular-nums text-muted-foreground">{formatDurationShort(dayTotal)}</span>
                </div>
                <ul className="space-y-0.5">
                  {day.entries.map((entry) => (
                    <li key={entry.id}>
                      <TimeEntryRow
                        entry={entry}
                        onEdit={openEdit}
                        onDeleted={handleDeleted}
                        onDeleteFailed={handleDeleteFailed}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      <MobileFab label={CREATE_LABEL} onClick={openCreate} />
      <MobileFabSpacer />

      <EntryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={dialog?.entry ?? null}
        now={dialog?.now}
        tags={tags}
        onSaved={handleSaved}
      />
    </>
  )
}
