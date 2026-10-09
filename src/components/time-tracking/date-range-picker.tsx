"use client"

import * as React from "react"
import { addMonths, format, startOfMonth } from "date-fns"
import { cs } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  DATE_RANGE_PRESETS,
  type DateKeyRange,
  EMPTY_SELECTION,
  MAX_RANGE_DAYS,
  type RangeSelection,
  addDaysToKey,
  clampRange,
  clickDay,
  highlightedRange,
  matchPreset,
  presetLabel,
  presetRange,
  shiftRange,
} from "@/lib/time-tracking/date-range"
import { cn } from "@/lib/utils"

import { dateFromKey, formatRangeLabel, keyFromDate } from "./cas-query"

const DESKTOP_MONTHS = 2
const MOBILE_MONTHS = 1

export interface DateRangePickerProps {
  /** Applied range (inclusive Prague days). */
  value: DateKeyRange
  onChange: (range: DateKeyRange) => void
  /** Prague „today" — anchors the presets and blocks ‹ › into the future. */
  todayKey: string
  /** Dims the label while a new range is loading. */
  isPending?: boolean
  /** Popover edge aligned with the trigger — `"end"` when the picker sits on the right. */
  align?: "start" | "end"
  className?: string
}

/**
 * Clockify-style period picker: ‹ label › with a popover of presets and a calendar.
 * First click picks the start, the second (same or later day) the end and applies;
 * an earlier second click moves the start. Closing mid-pick discards it.
 */
export function DateRangePicker({
  value,
  onChange,
  todayKey,
  isPending = false,
  align = "start",
  className,
}: DateRangePickerProps) {
  const isMobile = useIsMobile()
  const numberOfMonths = isMobile ? MOBILE_MONTHS : DESKTOP_MONTHS

  const [open, setOpen] = React.useState(false)
  const [selection, setSelection] = React.useState<RangeSelection>(EMPTY_SELECTION)
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null)
  const [month, setMonth] = React.useState(() => initialMonth(value, numberOfMonths))
  // Re-anchor the months when the layout flips between 1 and 2 months (resize, rotation),
  // otherwise the range end could sit in a month that is no longer shown.
  const [prevNumberOfMonths, setPrevNumberOfMonths] = React.useState(numberOfMonths)
  if (numberOfMonths !== prevNumberOfMonths) {
    setPrevNumberOfMonths(numberOfMonths)
    setMonth(initialMonth(value, numberOfMonths))
  }

  const activePreset = matchPreset(value, todayKey)
  const rangeLabel = formatRangeLabel(value)
  const next = shiftRange(value, 1)
  const canGoNext = next.from <= todayKey

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    // Every opening starts clean: no half-picked range, calendar on the applied range.
    setSelection(EMPTY_SELECTION)
    setHoveredKey(null)
    if (nextOpen) setMonth(initialMonth(value, numberOfMonths))
  }

  function apply(range: DateKeyRange) {
    handleOpenChange(false)
    onChange(range)
  }

  function handleDayClick(day: Date) {
    const result = clickDay(selection, keyFromDate(day))
    if (result.completed) {
      apply(clampRange(result.completed))
      return
    }
    setSelection(result.selection)
  }

  const highlight = highlightedRange(selection, hoveredKey, value)
  // While picking, days past the longest allowed range cannot be the end.
  const lastPickableKey = selection.anchor === null ? null : addDaysToKey(selection.anchor, MAX_RANGE_DAYS - 1)

  return (
    <ButtonGroup className={className} aria-busy={isPending || undefined}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Období: ${activePreset ? `${presetLabel(activePreset)}, ` : ""}${rangeLabel}`}
            className={cn("min-w-0 justify-start gap-2 font-normal transition-opacity", isPending && "opacity-60")}
          >
            <CalendarDays className="size-4 text-muted-foreground" />
            {activePreset ? (
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-medium">{presetLabel(activePreset)}</span>
                <span className="hidden truncate text-xs tabular-nums text-muted-foreground sm:inline">
                  {rangeLabel}
                </span>
              </span>
            ) : (
              <span className="truncate font-medium tabular-nums">{rangeLabel}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} className="w-auto max-w-[calc(100vw-2rem)] p-0">
          <div className="flex flex-col sm:flex-row">
            <ul
              aria-label="Rychlá volba období"
              className="flex flex-wrap gap-1 border-b p-2 sm:w-40 sm:flex-col sm:flex-nowrap sm:gap-0.5 sm:border-r sm:border-b-0"
            >
              {DATE_RANGE_PRESETS.map((preset) => {
                const active = preset.id === activePreset
                return (
                  <li key={preset.id}>
                    <Button
                      type="button"
                      variant={active ? "secondary" : "ghost"}
                      size="sm"
                      aria-pressed={active}
                      className="w-full justify-start font-normal"
                      onClick={() => apply(presetRange(preset.id, todayKey))}
                    >
                      {preset.label}
                    </Button>
                  </li>
                )
              })}
            </ul>
            <div onMouseLeave={() => setHoveredKey(null)}>
              <Calendar
                mode="range"
                // Selection is driven by `clickDay`; DayPicker only renders the highlight.
                // Without `onSelect` DayPicker treats `selected` as an initial value and
                // runs its own `addToRange` on clicks, drifting away from our state.
                selected={{ from: dateFromKey(highlight.from), to: dateFromKey(highlight.to) }}
                onSelect={ignoreDayPickerSelect}
                disabled={lastPickableKey === null ? undefined : { after: dateFromKey(lastPickableKey) }}
                onDayClick={handleDayClick}
                onDayMouseEnter={(day) => setHoveredKey(keyFromDate(day))}
                onDayFocus={(day) => setHoveredKey(keyFromDate(day))}
                month={month}
                onMonthChange={setMonth}
                numberOfMonths={numberOfMonths}
                showOutsideDays={numberOfMonths === MOBILE_MONTHS}
                fixedWeeks
                today={dateFromKey(todayKey)}
                labels={DAY_LABELS}
              />
              <p aria-live="polite" className="px-3 pb-3 text-xs text-muted-foreground">
                {selection.anchor === null ? "Klikni na první den období." : "Teď klikni na poslední den."}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Předchozí období"
        onClick={() => onChange(shiftRange(value, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Další období"
        disabled={!canGoNext}
        onClick={() => onChange(next)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </ButtonGroup>
  )
}

function ignoreDayPickerSelect() {}

/** Czech day labels for screen readers (DayPicker defaults to English „Today" / „selected"). */
const DAY_LABELS = {
  labelDayButton: (date: Date, modifiers: { today?: boolean; selected?: boolean }) =>
    `${modifiers.today ? "Dnes, " : ""}${format(date, "EEEE d. MMMM yyyy", { locale: cs })}${modifiers.selected ? ", vybráno" : ""}`,
}

/** First displayed month so the range end sits in the last visible month. */
function initialMonth(range: DateKeyRange, numberOfMonths: number): Date {
  return addMonths(startOfMonth(dateFromKey(range.to)), -(numberOfMonths - 1))
}
