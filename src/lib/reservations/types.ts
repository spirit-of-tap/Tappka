/**
 * Type definitions for the reservation system
 */

import type { Database } from '@/lib/supabase/database.types';
import type { Tables } from '@/lib/supabase/tables';

/** Schedule type from recurring_schedules (also used as inferred reservation kind). */
export type ScheduleType = Database['public']['Enums']['schedule_type'];

/** Inferred kind for a reservation row (no reservation_type column). */
export type ReservationKind = 'personal' | ScheduleType;

/** Stable title for Houston Calling generated reservations. */
export const HOUSTON_CALLING_TITLE = 'Houston Calling';

/** Fallback title for training session reservations when team name is unknown. */
export const TRAINING_SESSION_TITLE = 'Training Session';

/** Prefix used for team training session titles (`TS - ${teamName}`). */
export const TRAINING_SESSION_TITLE_PREFIX = 'TS - ';

// Room from database
export type Room = Tables<'rooms'>;

// Room with current status for display
export interface RoomWithStatus extends Room {
  currentReservation: Reservation | null;
  nextAvailableTime: Date | null;
  // Filter availability metadata (set when time filter is active)
  availabilityForFilter?: {
    isAvailable: boolean;
    reason?: 'occupied' | 'day_restricted';
    conflictTime?: string; // e.g., "13:00-15:00"
    conflictTitle?: string; // e.g., "Training Session"
  };
}

// Reservation from database
export type Reservation = Tables<'reservations'>;

// Reservation with joined data for display
export interface ReservationWithDetails extends Reservation {
  room?: Room;
  user?: {
    id: string;
    name: string;
    picture?: string | null;
  };
}

// Recurring schedule from database
export type RecurringSchedule = Tables<'recurring_schedules'>;

// Schedule break from database
export type ScheduleBreak = Tables<'schedule_breaks'>;

// Form data for creating a reservation
export interface CreateReservationInput {
  room_id: string;
  title: string; // Also serves as reason (simplified)
  person_count: number;
  start_at: string;
  end_at: string;
}

// Form data for updating a reservation
export interface UpdateReservationInput {
  title?: string;
  person_count?: number;
  start_at?: string;
  end_at?: string;
}

/** One of the current user's other reservations overlapping a requested time range. */
export interface OverlappingReservation {
  id: string;
  title: string;
  room_name: string | null;
}

/**
 * Non-blocking notice returned when a reservation overlaps another one of the
 * user's own reservations. Different rooms at the same time are allowed.
 */
export interface ReservationOverlapWarning {
  code: 'OWN_RESERVATIONS_OVERLAP';
  reservations: OverlappingReservation[];
}

/** Response body for POST /api/reservations and PATCH /api/reservations/[id]. */
export interface ReservationMutationResponse {
  success?: boolean;
  data?: Reservation;
  message?: string;
  error?: string;
  warning?: ReservationOverlapWarning;
}

// Constants
export const OPERATING_HOURS = {
  start: 7, // 7:00
  end: 22,  // 22:00
} as const;

export const TIME_SLOT_MINUTES = 15;

// Day names in Czech
export const DAY_NAMES_CS: Record<number, string> = {
  0: 'Neděle',
  1: 'Pondělí',
  2: 'Úterý',
  3: 'Středa',
  4: 'Čtvrtek',
  5: 'Pátek',
  6: 'Sobota',
};

/** Reservation kind labels in Czech */
export const RESERVATION_KIND_LABELS: Record<ReservationKind, string> = {
  personal: 'Osobní',
  training_session: 'Training Session',
  houston_calling: 'Houston Calling',
};

/** @deprecated Use RESERVATION_KIND_LABELS */
export const RESERVATION_TYPE_LABELS = RESERVATION_KIND_LABELS;
