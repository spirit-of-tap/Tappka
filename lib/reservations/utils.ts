/**
 * Utility functions for the reservation system
 */

import { 
  OPERATING_HOURS, 
  TIME_SLOT_MINUTES,
  type Room,
  type Reservation,
} from './types';

/**
 * Check if a room is available on a specific day of week
 */
export function isRoomAvailableOnDay(room: Room, date: Date): boolean {
  if (!room.available_days || room.available_days.length === 0) {
    return true; // NULL means all days
  }
  return room.available_days.includes(date.getDay());
}

/**
 * Check if a time is within operating hours
 */
export function isWithinOperatingHours(date: Date): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  if (hours < OPERATING_HOURS.start) return false;
  if (hours >= OPERATING_HOURS.end) return false;
  if (hours === OPERATING_HOURS.end && minutes > 0) return false;
  
  return true;
}

/**
 * Round time to nearest slot (15 minutes)
 */
export function roundToSlot(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const remainder = minutes % TIME_SLOT_MINUTES;
  
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (TIME_SLOT_MINUTES - remainder));
  }
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  
  return rounded;
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
    return roundToSlot(referenceTime);
  }

  // Sort by end time
  const sorted = [...reservations]
    .sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());

  // Find the first gap or the end of last reservation
  let currentTime = roundToSlot(referenceTime);
  
  for (const reservation of sorted) {
    const startTime = new Date(reservation.start_time);
    const endTime = new Date(reservation.end_time);
    
    if (currentTime < startTime) {
      // Found a gap
      return currentTime;
    }
    
    if (currentTime < endTime) {
      currentTime = roundToSlot(endTime);
    }
  }
  
  return currentTime;
}

/**
 * Check if a reservation is currently active (happening now)
 */
export function isReservationActive(reservation: Reservation): boolean {
  const now = new Date();
  const start = new Date(reservation.start_time);
  const end = new Date(reservation.end_time);
  
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
 * Get background color classes for reservation type
 */
export function getReservationColorClasses(type: string): string {
  switch (type) {
    case "training_session":
      return "bg-red-100 dark:bg-red-950/50 border-red-500 text-red-900 dark:text-red-100";
    case "houston_calling":
      return "bg-purple-100 dark:bg-purple-950/50 border-purple-500 text-purple-900 dark:text-purple-100";
    default:
      return "bg-blue-100 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-100";
  }
}

/**
 * Calculate time until reservation ends, in minutes
 */
export function getMinutesUntilFree(reservation: Reservation): number {
  const now = new Date();
  const end = new Date(reservation.end_time);
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
  const end = new Date(reservation.end_time);
  return `v ${formatTime(end)}`;
}

/**
 * Get end time for quick reservation
 */
export function getQuickReservationEnd(durationMinutes: 30 | 60 | 120): Date {
  const now = new Date();
  const rounded = roundToSlot(now);
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
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    return now >= start && now < end;
  });
}
