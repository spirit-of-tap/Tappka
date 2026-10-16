import { pragueLocalToUtcISO } from "@/lib/reservations/utils"

import { TS_LIMITS } from "./constants"
import { pragueDateKey } from "./format"

export interface ScheduleSource {
  dayOfWeek: number
  startTime: string
  endTime: string
  validFrom: string
  validUntil: string | null
  roomId: string
}

export interface BreakRange {
  startDate: string
  endDate: string
}

export interface UpcomingSlotsInput {
  schedules: ScheduleSource[]
  breaks: BreakRange[]
  takenDateKeys: string[]
  now: Date
  limit?: number
}

export interface UpcomingSlot {
  dateKey: string
  startsAt: string
  endsAt: string
  roomId: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function addDaysToKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

function weekdayOfKey(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay()
}

export function getUpcomingTeamSlots({
  schedules,
  breaks,
  takenDateKeys,
  now,
  limit = TS_LIMITS.slotSuggestions,
}: UpcomingSlotsInput): UpcomingSlot[] {
  const taken = new Set(takenDateKeys)
  const today = pragueDateKey(now)
  const slots: UpcomingSlot[] = []

  for (let offset = 0; offset <= TS_LIMITS.slotHorizonDays; offset += 1) {
    const dateKey = addDaysToKey(today, offset)
    if (taken.has(dateKey)) continue
    if (breaks.some((b) => dateKey >= b.startDate && dateKey <= b.endDate)) continue
    const weekday = weekdayOfKey(dateKey)

    for (const schedule of schedules) {
      if (schedule.dayOfWeek !== weekday) continue
      if (dateKey < schedule.validFrom) continue
      if (schedule.validUntil && dateKey > schedule.validUntil) continue
      const startsAt = pragueLocalToUtcISO(dateKey, schedule.startTime)
      if (new Date(startsAt).getTime() <= now.getTime()) continue
      slots.push({ dateKey, startsAt, endsAt: pragueLocalToUtcISO(dateKey, schedule.endTime), roomId: schedule.roomId })
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, limit)
}
