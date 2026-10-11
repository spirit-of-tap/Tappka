"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  CALENDAR_DEFAULT_BLOCK_MINUTES,
  CALENDAR_HOUR_HEIGHT,
  CALENDAR_SCROLL_TO_HOUR,
  CALENDAR_SNAP_MINUTES,
  DAYS_PER_WEEK,
  MINUTES_PER_DAY,
  calendarSegments,
  dayDifference,
  minutesToClock,
  minutesToPx,
  movedRange,
  pragueMinuteOfDay,
  pxToMinutes,
  resizedEnd,
  snapMinutes,
  weekDayKeys,
  type CalendarSegment,
} from "@/lib/time-tracking/calendar"
import { TIME_DIRECTION_LABELS, TIME_TRACKING_MESSAGES } from "@/lib/time-tracking/constants"
import { addDaysToKey, weekRangeOf } from "@/lib/time-tracking/date-range"
import type { TagCatalog, TimeDirection, TimeEntryWithTag } from "@/lib/time-tracking/types"
import { cn } from "@/lib/utils"

import { formatRangeLabel, withRangeParams } from "./cas-query"
import { EntryFormDialog, type EntryInitialRange } from "./entry-form-dialog"
import { localInputsToIso } from "./local-datetime"
import { ENTRIES_ENDPOINT, readApiError } from "./time-entry-row"
import { useOptionalTimer } from "./timer-provider"

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const GRID_HEIGHT = minutesToPx(MINUTES_PER_DAY)
/** Pointer travel (px) before a press on a block becomes a drag instead of a click. */
const DRAG_THRESHOLD_PX = 4
/** Blocks shorter than this still get a clickable height. */
const MIN_BLOCK_HEIGHT_PX = 18
/** Blocks at least this tall show a second line (time range). */
const TWO_LINE_BLOCK_HEIGHT_PX = 36
const NOW_TICK_MS = 60_000
/** Scroll a bit above the first hour so its label is not cut off. */
const SCROLL_LABEL_OFFSET_PX = 8
const ENTRY_MOVED_MESSAGE = "Záznam přesunut"
const CREATE_LABEL = "Zapsat čas"
const RUNNING_HINT = "Běžící časomíra, kliknutím ji zastavíš"

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("cs-CZ", { weekday: "short", timeZone: "UTC" })
const DAY_FORMAT = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" })

const BLOCK_CLASSES: Record<TimeDirection, string> = {
  training: "border-time-training bg-time-training/20",
  reading: "border-time-reading bg-time-reading/25",
  practise: "border-time-practise bg-time-practise/15",
  project: "border-time-project bg-time-project/15",
}

function keyToUtcDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`)
}

/** ISO instant for a minute of a Prague day (1440 = next day's midnight). */
function dayMinuteToIso(dayKey: string, minute: number): string | null {
  return minute >= MINUTES_PER_DAY
    ? localInputsToIso(addDaysToKey(dayKey, 1), "00:00")
    : localInputsToIso(dayKey, minutesToClock(minute))
}

function signedSnap(minutes: number): number {
  return Math.round(minutes / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES
}

function entryLabel(entry: TimeEntryWithTag): string {
  return entry.title ?? entry.tag?.name ?? TIME_DIRECTION_LABELS[entry.direction]
}

type DragState =
  | { kind: "create"; dayKey: string; anchorMinute: number; currentMinute: number }
  | {
      kind: "move"
      entryId: string
      originDayKey: string
      originMinute: number
      startX: number
      startY: number
      moved: boolean
      dayDelta: number
      minuteDelta: number
    }
  | { kind: "resize"; entryId: string; startY: number; minuteDelta: number }

interface DialogState {
  entry: TimeEntryWithTag | null
  initialRange?: EntryInitialRange
}

export interface TimeCalendarProps {
  entries: TimeEntryWithTag[]
  tagCatalog: TagCatalog
  /** Monday of the shown week, `YYYY-MM-DD` (Prague). */
  weekStartKey: string
  todayKey: string
  now: Date
}

/**
 * Personal week calendar of time entries (day view on phones). Drag on an empty slot to
 * create a block, drag a block to move it (also to another day), drag its bottom edge to
 * change the length, click to edit or delete. Touch: tap to create or edit.
 */
export function TimeCalendar({ entries, tagCatalog, weekStartKey, todayKey, now }: TimeCalendarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const timer = useOptionalTimer()

  // Local copy for optimistic moves; adopt fresh server data after router.refresh().
  const [items, setItems] = React.useState(entries)
  const [prevEntries, setPrevEntries] = React.useState(entries)
  if (entries !== prevEntries) {
    setPrevEntries(entries)
    setItems(entries)
  }

  const weekDays = React.useMemo(() => weekDayKeys(weekStartKey), [weekStartKey])
  const [mobileDay, setMobileDay] = React.useState(() => (weekDays.includes(todayKey) ? todayKey : weekStartKey))
  const visibleDays = isMobile ? [weekDays.includes(mobileDay) ? mobileDay : weekStartKey] : weekDays

  const [liveNow, setLiveNow] = React.useState(now)
  React.useEffect(() => {
    const id = window.setInterval(() => setLiveNow(new Date()), NOW_TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  const [drag, setDrag] = React.useState<DragState | null>(null)
  const dragRef = React.useRef<DragState | null>(null)
  dragRef.current = drag
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialog, setDialog] = React.useState<DialogState>({ entry: null })

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const columnRefs = React.useRef(new Map<string, HTMLDivElement>())

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = minutesToPx(CALENDAR_SCROLL_TO_HOUR * 60) - SCROLL_LABEL_OFFSET_PX
  }, [])

  // ── Navigation ────────────────────────────────────────────────────────────
  function goToWeek(startKey: string) {
    const params = withRangeParams(searchParams, weekRangeOf(startKey), todayKey)
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  function step(direction: -1 | 1) {
    if (!isMobile) {
      goToWeek(addDaysToKey(weekStartKey, direction * DAYS_PER_WEEK))
      return
    }
    const next = addDaysToKey(visibleDays[0] ?? weekStartKey, direction)
    setMobileDay(next)
    if (!weekDays.includes(next)) goToWeek(weekRangeOf(next).from)
  }

  function goToday() {
    setMobileDay(todayKey)
    if (!weekDays.includes(todayKey)) goToWeek(weekRangeOf(todayKey).from)
  }

  // ── Dialog ────────────────────────────────────────────────────────────────
  function openCreate(initialRange?: EntryInitialRange) {
    setDialog({ entry: null, initialRange })
    setDialogOpen(true)
  }

  function openEdit(entry: TimeEntryWithTag) {
    setDialog({ entry })
    setDialogOpen(true)
  }

  function handleSaved(saved: TimeEntryWithTag) {
    setItems((current) =>
      current.some((item) => item.id === saved.id)
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved],
    )
  }

  // ── Saving a move / resize ────────────────────────────────────────────────
  async function patchTimes(entry: TimeEntryWithTag, payload: { startedAt?: string; endedAt?: string }) {
    const previous = items
    setItems((current) =>
      current.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              started_at: payload.startedAt ?? item.started_at,
              ended_at: payload.endedAt ?? item.ended_at,
            }
          : item,
      ),
    )
    try {
      const response = await fetch(`${ENTRIES_ENDPOINT}/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        setItems(previous)
        toast.error(await readApiError(response))
        return
      }
      const body = (await response.json()) as { data?: TimeEntryWithTag }
      if (body.data) handleSaved(body.data)
      toast.success(ENTRY_MOVED_MESSAGE)
      router.refresh()
    } catch {
      setItems(previous)
      toast.error(TIME_TRACKING_MESSAGES.generic)
    }
  }

  // ── Pointer helpers ───────────────────────────────────────────────────────
  function pointerPosition(clientX: number, clientY: number): { dayKey: string; minute: number } | null {
    let best: { dayKey: string; minute: number; distance: number } | null = null
    for (const dayKey of visibleDays) {
      const column = columnRefs.current.get(dayKey)
      if (!column) continue
      const rect = column.getBoundingClientRect()
      const distance = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0
      if (best === null || distance < best.distance) {
        best = { dayKey, minute: pxToMinutes(clientY - rect.top), distance }
      }
    }
    return best && { dayKey: best.dayKey, minute: best.minute }
  }

  const finishDrag = React.useCallback(
    (state: DragState) => {
      if (state.kind === "create") {
        const low = Math.min(state.anchorMinute, state.currentMinute)
        const high = Math.max(state.anchorMinute, state.currentMinute)
        const isClick = high - low < CALENDAR_SNAP_MINUTES
        const startMinute = isClick
          ? Math.floor(state.anchorMinute / CALENDAR_SNAP_MINUTES) * CALENDAR_SNAP_MINUTES
          : snapMinutes(low)
        const endMinute = isClick
          ? Math.min(startMinute + CALENDAR_DEFAULT_BLOCK_MINUTES, MINUTES_PER_DAY)
          : Math.max(snapMinutes(high), startMinute + CALENDAR_SNAP_MINUTES)
        const startedAt = dayMinuteToIso(state.dayKey, startMinute)
        const endedAt = dayMinuteToIso(state.dayKey, endMinute)
        if (startedAt && endedAt) openCreate({ startedAt, endedAt })
        return
      }
      const entry = items.find((item) => item.id === state.entryId)
      if (!entry) return
      if (state.kind === "move") {
        if (!state.moved) {
          openEdit(entry)
          return
        }
        const range = movedRange(entry, state.dayDelta, state.minuteDelta)
        if (range && (state.dayDelta !== 0 || state.minuteDelta !== 0)) void patchTimes(entry, range)
        return
      }
      const endedAt = resizedEnd(entry, state.minuteDelta)
      if (endedAt && state.minuteDelta !== 0) void patchTimes(entry, { endedAt })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the latest items at pointer-up
    [items],
  )

  React.useEffect(() => {
    if (drag === null) return

    function handleMove(event: PointerEvent) {
      const current = dragRef.current
      if (!current) return
      if (current.kind === "resize") {
        setDrag({ ...current, minuteDelta: signedSnap(pxToMinutes(event.clientY - current.startY)) })
        return
      }
      const position = pointerPosition(event.clientX, event.clientY)
      if (!position) return
      if (current.kind === "create") {
        setDrag({ ...current, currentMinute: Math.min(Math.max(position.minute, 0), MINUTES_PER_DAY) })
        return
      }
      const travelled = Math.hypot(event.clientX - current.startX, event.clientY - current.startY)
      const moved = current.moved || travelled > DRAG_THRESHOLD_PX
      setDrag({
        ...current,
        moved,
        dayDelta: moved ? dayDifference(current.originDayKey, position.dayKey) : 0,
        minuteDelta: moved ? signedSnap(position.minute - current.originMinute) : 0,
      })
    }

    function handleUp() {
      const current = dragRef.current
      setDrag(null)
      if (current) finishDrag(current)
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp, { once: true })
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
    // Re-subscribe only when a drag starts or ends, not on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag === null, finishDrag])

  function handleColumnPointerDown(event: React.PointerEvent<HTMLDivElement>, dayKey: string) {
    if (event.button !== 0 || event.target !== event.currentTarget) return
    const minute = pxToMinutes(event.clientY - event.currentTarget.getBoundingClientRect().top)
    if (event.pointerType === "touch") {
      // Touch keeps native scrolling: a tap creates a default block (see onClick below).
      return
    }
    event.preventDefault()
    setDrag({ kind: "create", dayKey, anchorMinute: minute, currentMinute: minute })
  }

  function handleColumnTap(event: React.MouseEvent<HTMLDivElement>, dayKey: string) {
    if (!isMobile || event.target !== event.currentTarget) return
    const minute = pxToMinutes(event.clientY - event.currentTarget.getBoundingClientRect().top)
    finishDrag({ kind: "create", dayKey, anchorMinute: minute, currentMinute: minute })
  }

  function handleBlockPointerDown(event: React.PointerEvent, entry: TimeEntryWithTag, segment: CalendarSegment) {
    if (event.button !== 0) return
    event.stopPropagation()
    if (entry.ended_at === null) return
    if (event.pointerType === "touch") return
    event.preventDefault()
    const position = pointerPosition(event.clientX, event.clientY)
    setDrag({
      kind: "move",
      entryId: entry.id,
      originDayKey: position?.dayKey ?? segment.dateKey,
      originMinute: position?.minute ?? segment.startMinute,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      dayDelta: 0,
      minuteDelta: 0,
    })
  }

  function handleResizePointerDown(event: React.PointerEvent, entry: TimeEntryWithTag) {
    if (event.button !== 0 || event.pointerType === "touch") return
    event.stopPropagation()
    event.preventDefault()
    setDrag({ kind: "resize", entryId: entry.id, startY: event.clientY, minuteDelta: 0 })
  }

  function handleBlockClick(event: React.MouseEvent, entry: TimeEntryWithTag) {
    event.stopPropagation()
    if (entry.ended_at === null) {
      timer?.openStopSheet()
      return
    }
    // Mouse clicks are handled at pointer-up (a press without travel); touch taps land here.
    if (isMobile || (event.nativeEvent as PointerEvent).pointerType === "touch") openEdit(entry)
  }

  // ── Preview of the dragged entry ──────────────────────────────────────────
  const displayItems = React.useMemo(() => {
    if (drag === null || drag.kind === "create") return items
    return items.map((item) => {
      if (item.id !== drag.entryId) return item
      if (drag.kind === "move") {
        const range = drag.moved ? movedRange(item, drag.dayDelta, drag.minuteDelta) : null
        return range ? { ...item, started_at: range.startedAt, ended_at: range.endedAt } : item
      }
      const endedAt = resizedEnd(item, drag.minuteDelta)
      return endedAt ? { ...item, ended_at: endedAt } : item
    })
  }, [items, drag])

  const segments = React.useMemo(
    () => calendarSegments(displayItems, visibleDays, liveNow),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- visibleDays is derived from these
    [displayItems, weekDays, isMobile, mobileDay, liveNow],
  )
  const entriesById = React.useMemo(() => new Map(displayItems.map((item) => [item.id, item])), [displayItems])
  const nowMinute = pragueMinuteOfDay(liveNow)
  const headerLabel = isMobile
    ? `${WEEKDAY_FORMAT.format(keyToUtcDate(visibleDays[0] ?? weekStartKey))} ${DAY_FORMAT.format(keyToUtcDate(visibleDays[0] ?? weekStartKey))}`
    : formatRangeLabel({ from: weekStartKey, to: addDaysToKey(weekStartKey, DAYS_PER_WEEK - 1) })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => step(-1)} aria-label={isMobile ? "Předchozí den" : "Předchozí týden"}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => step(1)} aria-label={isMobile ? "Další den" : "Další týden"}>
            <ChevronRight aria-hidden />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goToday}>
            Dnes
          </Button>
        </div>
        <p className="text-sm font-medium tabular-nums" aria-live="polite">
          {headerLabel}
        </p>
        <Button type="button" size="sm" className="ml-auto" onClick={() => openCreate()}>
          <Plus aria-hidden />
          {CREATE_LABEL}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex border-b">
          <div className="w-12 shrink-0" />
          {visibleDays.map((dayKey) => (
            <div
              key={dayKey}
              className={cn(
                "flex-1 border-l py-2 text-center text-xs",
                dayKey === todayKey ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              <span className="capitalize">{WEEKDAY_FORMAT.format(keyToUtcDate(dayKey))}</span>{" "}
              <span className="tabular-nums">{DAY_FORMAT.format(keyToUtcDate(dayKey))}</span>
            </div>
          ))}
        </div>

        <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
          <div className={cn("relative flex", drag !== null && "select-none")} style={{ height: GRID_HEIGHT }}>
            <div className="relative w-12 shrink-0" aria-hidden>
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                  style={{ top: hour * CALENDAR_HOUR_HEIGHT }}
                >
                  {hour === 0 ? "" : `${hour}:00`}
                </span>
              ))}
            </div>

            {visibleDays.map((dayKey) => (
              <div
                key={dayKey}
                ref={(element) => {
                  if (element) columnRefs.current.set(dayKey, element)
                  else columnRefs.current.delete(dayKey)
                }}
                data-testid={`calendar-day-${dayKey}`}
                className={cn("relative flex-1 cursor-crosshair border-l", dayKey === todayKey && "bg-primary/[0.03]")}
                onPointerDown={(event) => handleColumnPointerDown(event, dayKey)}
                onClick={(event) => handleColumnTap(event, dayKey)}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                    style={{ top: hour * CALENDAR_HOUR_HEIGHT }}
                  />
                ))}

                {segments
                  .filter((segment) => segment.dateKey === dayKey)
                  .map((segment) => {
                    const entry = entriesById.get(segment.entryId)
                    if (!entry) return null
                    const running = entry.ended_at === null
                    const height = Math.max(minutesToPx(segment.endMinute - segment.startMinute), MIN_BLOCK_HEIGHT_PX)
                    const isDragged = drag !== null && drag.kind !== "create" && drag.entryId === entry.id
                    const label = entryLabel(entry)
                    const timeRange = `${minutesToClock(segment.startMinute)}–${minutesToClock(segment.endMinute)}`
                    return (
                      <div
                        key={`${segment.entryId}-${segment.dateKey}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${label}, ${timeRange}${running ? `, ${RUNNING_HINT}` : ""}`}
                        title={running ? RUNNING_HINT : `${label} · ${timeRange}`}
                        className={cn(
                          "absolute inset-x-0.5 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs text-foreground shadow-xs focus-ring",
                          BLOCK_CLASSES[entry.direction],
                          running ? "cursor-pointer border-dashed" : "cursor-grab active:cursor-grabbing",
                          isDragged && "z-10 opacity-80 ring-2 ring-ring",
                        )}
                        style={{ top: minutesToPx(segment.startMinute), height }}
                        onPointerDown={(event) => handleBlockPointerDown(event, entry, segment)}
                        onClick={(event) => handleBlockClick(event, entry)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return
                          event.preventDefault()
                          if (running) timer?.openStopSheet()
                          else openEdit(entry)
                        }}
                      >
                        <p className="truncate font-medium leading-tight">{label}</p>
                        {height >= TWO_LINE_BLOCK_HEIGHT_PX && (
                          <p className="truncate leading-tight text-muted-foreground tabular-nums">
                            {timeRange}
                            {entry.tag && entry.title !== null ? ` · ${entry.tag.name}` : ""}
                          </p>
                        )}
                        {segment.isLast && !running && (
                          <div
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                            onPointerDown={(event) => handleResizePointerDown(event, entry)}
                          />
                        )}
                      </div>
                    )
                  })}

                {drag?.kind === "create" && drag.dayKey === dayKey && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0.5 rounded-md border-2 border-dashed border-primary bg-primary/10"
                    style={{
                      top: minutesToPx(snapMinutes(Math.min(drag.anchorMinute, drag.currentMinute))),
                      height: Math.max(
                        minutesToPx(
                          snapMinutes(Math.max(drag.anchorMinute, drag.currentMinute)) -
                            snapMinutes(Math.min(drag.anchorMinute, drag.currentMinute)),
                        ),
                        minutesToPx(CALENDAR_SNAP_MINUTES),
                      ),
                    }}
                  />
                )}

                {dayKey === todayKey && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-primary"
                    style={{ top: minutesToPx(nowMinute) }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {isMobile
          ? "Klepnutím do prázdného místa zapíšeš čas, klepnutím na blok ho upravíš."
          : "Táhni v prázdném místě pro nový záznam, blok přesuneš tažením a délku změníš za spodní okraj."}
      </p>

      <EntryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={dialog.entry}
        initialRange={dialog.initialRange}
        tagCatalog={tagCatalog}
        now={now}
        onSaved={handleSaved}
        onDeleted={(id) => setItems((current) => current.filter((item) => item.id !== id))}
      />
    </div>
  )
}
