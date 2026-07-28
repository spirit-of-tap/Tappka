/**
 * Utility functions for the reservation system
 */

import {
  OPERATING_HOURS,
  TIME_SLOT_MINUTES,
  HOUSTON_CALLING_TITLE,
  TRAINING_SESSION_TITLE,
  TRAINING_SESSION_TITLE_PREFIX,
  type Room,
  type Reservation,
  type ReservationKind,
} from './types';

/**
 * Check if a room is available on a specific day of week.
 * Uses Europe/Prague timezone to determine the weekday.
 */
export function isRoomAvailableOnDay(room: Room, date: Date): boolean {
  if (!room.available_days || room.available_days.length === 0) {
    return true; // NULL means all days
  }

  // Derive weekday in Europe/Prague timezone using formatToParts
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    weekday: "short",
  }).formatToParts(date);

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value;

  // Map short weekday names to JS getDay() format: 0 (Sunday) to 6 (Saturday)
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weekdayNumber = weekdayStr ? weekdayMap[weekdayStr] : 0;

  return room.available_days.includes(weekdayNumber);
}

const PRAGUE_TZ = "Europe/Prague";

/**
 * Convert a date string (YYYY-MM-DD) and time string (HH:MM or HH:MM:SS)
 * from Europe/Prague local time to a UTC ISO string.
 *
 * Training session times are user-entered in Prague time, but
 * reservations.start_at / end_at are TIMESTAMPTZ columns stored as UTC.
 */
export function pragueLocalToUtcISO(dateStr: string, timeStr: string): string {
  // Normalise time to HH:MM:SS
  const timePart = timeStr.length === 5 ? `${timeStr}:00` : timeStr;

  // Build an ISO-8601 string that Intl can resolve in the Prague zone.
  // We do this by asking the runtime what UTC instant corresponds to
  // "YYYY-MM-DDTHH:MM:SS" in Europe/Prague.
  const naiveISO = `${dateStr}T${timePart}`;

  // Use Intl to get the Prague-zone offset at this instant.
  // Strategy: create a Date from the naive string (JS treats it as LOCAL
  // time of the runtime, which may be UTC on the server), then correct
  // for the difference between Prague offset and the runtime offset.
  const runtimeDate = new Date(naiveISO);

  // Get the UTC offset for Prague at this instant (in minutes, e.g. +60 or +120)
  const pragueOffsetMin = getPragueOffsetMinutes(runtimeDate);
  // Get the runtime (server) UTC offset in minutes (0 on production servers)
  const runtimeOffsetMin = -runtimeDate.getTimezoneOffset();

  // Adjust: if runtime parsed it as UTC (offset 0) but Prague is +60,
  // we need to subtract 60 minutes from the UTC time.
  const correctedDate = new Date(
    runtimeDate.getTime() - (pragueOffsetMin - runtimeOffsetMin) * 60_000
  );

  return correctedDate.toISOString();
}

/**
 * Get the current UTC offset of Europe/Prague for a given instant, in minutes.
 * Returns e.g. 60 for CET (+01:00) or 120 for CEST (+02:00).
 */
function getPragueOffsetMinutes(date: Date): number {
  // Format the date twice: once in UTC, once in Prague. The difference is the offset.
  const utcStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const pragueStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRAGUE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const utcMs = new Date(utcStr.replace(", ", "T")).getTime();
  const pragueMs = new Date(pragueStr.replace(", ", "T")).getTime();

  return (pragueMs - utcMs) / 60_000;
}

function getPragueHourAndMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: PRAGUE_TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return { hour, minute };
}

/**
 * Build the stable title for a training session reservation.
 */
export function trainingSessionTitle(teamName: string): string {
  return `${TRAINING_SESSION_TITLE_PREFIX}${teamName}`;
}

/**
 * Infer reservation kind from title / owner (no reservation_type column).
 */
export function inferReservationKind(
  reservation: Pick<Reservation, "title" | "owner_profile_id">
): ReservationKind {
  const title = reservation.title.trim();

  if (
    title === HOUSTON_CALLING_TITLE ||
    title.toLowerCase() === "houston calling"
  ) {
    return "houston_calling";
  }

  if (
    title === TRAINING_SESSION_TITLE ||
    title.startsWith(TRAINING_SESSION_TITLE_PREFIX)
  ) {
    return "training_session";
  }

  if (reservation.owner_profile_id) {
    return "personal";
  }

  // System-generated rows without a recognised title — treat as personal display.
  return "personal";
}

/**
 * Check if a time is within operating hours
 */
export function isWithinOperatingHours(date: Date): boolean {
  const { hour, minute } = getPragueHourAndMinute(date);

  if (hour < OPERATING_HOURS.start) return false;
  if (hour >= OPERATING_HOURS.end) return false;
  if (hour === OPERATING_HOURS.end && minute > 0) return false;

  return true;
}

/**
 * Round time to nearest slot (15 minutes)
 */
export function roundToSlot(date: Date, direction: "floor" | "ceil" = "floor"): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % TIME_SLOT_MINUTES;

  if (remainder !== 0) {
    if (direction === "floor") {
      rounded.setMinutes(minutes - remainder);
    } else {
      rounded.setMinutes(minutes + (TIME_SLOT_MINUTES - remainder));
    }
  }
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);

  return rounded;
}

/** Round up to next slot (legacy behavior). */
export function roundToNextSlot(date: Date): Date {
  return roundToSlot(date, "ceil");
}

/**
 * Generate time slots for a day
 */
export function generateTimeSlots(date: Date): Date[] {
  const slots: Date[] = [];
  const day = new Date(date);
  day.setHours(OPERATING_HOURS.start, 0, 0, 0);
  
  while (day.getHours() < OPERATING_HOURS.end) {
    slots.push(new Date(day));
    day.setMinutes(day.getMinutes() + TIME_SLOT_MINUTES);
  }
  
  return slots;
}

/**
 * Format time as HH:MM
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('cs-CZ', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format date as short string
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format date and time together
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Check if two time ranges overlap
 */
export function doTimesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Get the next available time after existing reservations
 */
export function getNextAvailableTime(
  reservations: Reservation[],
  referenceTime: Date = new Date()
): Date | null {
  if (reservations.length === 0) {
    return roundToNextSlot(referenceTime);
  }

  // Sort by end time
  const sorted = [...reservations]
    .sort((a, b) => new Date(a.end_at).getTime() - new Date(b.end_at).getTime());

  // Find the first gap or the end of last reservation
  let currentTime = roundToNextSlot(referenceTime);

  for (const reservation of sorted) {
    const startTime = new Date(reservation.start_at);
    const endTime = new Date(reservation.end_at);

    if (currentTime < startTime) {
      // Found a gap
      return currentTime;
    }

    if (currentTime < endTime) {
      currentTime = roundToNextSlot(endTime);
    }
  }

  return currentTime;
}

/** Duration used when a reservation is started without an explicit time range. */
export const DEFAULT_RESERVATION_MINUTES = 60;

/**
 * Find the first bookable time range on a given day.
 *
 * Walks the day's slots from the start of operating hours (or from the next
 * slot after `now` when `day` is today) and returns the first window of
 * `durationMinutes` that does not overlap any of `reservations`.
 *
 * Used by the keyboard-reachable "add reservation" affordance in the schedule
 * views: the quick-reservation dialog always renders a start/end pair, so a
 * concrete range is required to open it.
 *
 * When the whole day is taken it returns the last window of the day, which
 * lets the caller's normal conflict-resolution flow offer alternatives.
 */
export function getFirstBookableRange(
  day: Date,
  reservations: Reservation[],
  durationMinutes: number = DEFAULT_RESERVATION_MINUTES,
  now: Date = new Date()
): { startTime: Date; endTime: Date } {
  const dayStart = new Date(day);
  dayStart.setHours(OPERATING_HOURS.start, 0, 0, 0);

  const dayEnd = new Date(day);
  dayEnd.setHours(OPERATING_HOURS.end, 0, 0, 0);

  const durationMs = durationMinutes * 60_000;
  const slotMs = TIME_SLOT_MINUTES * 60_000;
  const lastStartMs = dayEnd.getTime() - durationMs;

  // On today's schedule, skip slots that have already started.
  const firstStartMs =
    now > dayStart && now < dayEnd
      ? roundToSlot(now, "ceil").getTime()
      : dayStart.getTime();

  for (let startMs = firstStartMs; startMs <= lastStartMs; startMs += slotMs) {
    const startTime = new Date(startMs);
    const endTime = new Date(startMs + durationMs);

    const isFree = !reservations.some((reservation) =>
      doTimesOverlap(
        startTime,
        endTime,
        new Date(reservation.start_at),
        new Date(reservation.end_at)
      )
    );

    if (isFree) {
      return { startTime, endTime };
    }
  }

  return { startTime: new Date(lastStartMs), endTime: new Date(dayEnd) };
}

/**
 * Check if a reservation is currently active (happening now)
 */
export function isReservationActive(reservation: Reservation): boolean {
  const now = new Date();
  const start = new Date(reservation.start_at);
  const end = new Date(reservation.end_at);
  
  return now >= start && now < end;
}

/**
 * Get reservation status color
 */
export function getReservationStatusColor(
  reservation: Reservation | null,
  hasIssue: boolean
): 'green' | 'red' | 'yellow' | 'orange' {
  if (hasIssue) return 'orange';
  if (!reservation) return 'green';
  if (isReservationActive(reservation)) return 'red';
  return 'yellow';
}

/**
 * Calculate duration in hours
 */
export function getDurationHours(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * Get background color classes for reservation kind
 */
export function getReservationColorClasses(kind: ReservationKind | string): string {
  switch (kind) {
    case "training_session":
      return "bg-chart-1/10 border-chart-1 text-chart-1";
    case "houston_calling":
      return "bg-chart-4/10 border-chart-4 text-chart-4";
    default:
      return "bg-chart-3/10 border-chart-3 text-chart-3";
  }
}

/**
 * Calculate time until reservation ends, in minutes
 */
export function getMinutesUntilFree(reservation: Reservation): number {
  const now = new Date();
  const end = new Date(reservation.end_at);
  return Math.round((end.getTime() - now.getTime()) / (1000 * 60));
}

/**
 * Format "free in X time" message
 * Returns: "za 15 minut" or "v 14:30" (if more than 90 min)
 */
export function formatTimeUntilFree(reservation: Reservation): string {
  const minutes = getMinutesUntilFree(reservation);
  
  if (minutes <= 0) {
    return "právě teď";
  }
  
  if (minutes <= 90) {
    return `za ${minutes} ${minutes === 1 ? 'minutu' : minutes < 5 ? 'minuty' : 'minut'}`;
  }
  
  // Show time instead
  const end = new Date(reservation.end_at);
  return `v ${formatTime(end)}`;
}

/**
 * Get end time for quick reservation
 */
export function getQuickReservationEnd(durationMinutes: 30 | 60 | 120): Date {
  const now = new Date();
  const rounded = roundToNextSlot(now);
  const end = new Date(rounded);
  end.setMinutes(end.getMinutes() + durationMinutes);
  return end;
}

/**
 * Check if room is currently free
 */
export function isRoomFreeNow(reservations: Reservation[]): boolean {
  const now = new Date();
  return !reservations.some(r => {
    const start = new Date(r.start_at);
    const end = new Date(r.end_at);
    return now >= start && now < end;
  });
}
