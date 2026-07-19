/**
 * Type definitions for the reservation system
 */

import type { Database } from '@/lib/supabase/database.types';
import type { Tables } from '@/lib/supabase/tables';

// Database enum types
export type ReservationType = Database['public']['Enums']['reservation_type'];
export type IssueType = Database['public']['Enums']['issue_type'];
export type IssueStatus = Database['public']['Enums']['issue_status'];
export type ScheduleBreakType = Database['public']['Enums']['schedule_break_type'];

// Room from database
export type Room = Tables<'rooms'>;

// Room with current status for display
export interface RoomWithStatus extends Room {
  currentReservation: Reservation | null;
  nextAvailableTime: Date | null;
  hasOpenIssue: boolean;
  issueType: IssueType | null;
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
  team?: {
    id: string;
    name: string;
  };
  cowork_participants?: CoworkParticipant[];
}

// Cowork participant (row + optional joined user)
export type CoworkParticipant = Tables<'cowork_participants'> & {
  user?: {
    id: string;
    name: string;
  };
};

// Room issue from database
export type RoomIssue = Tables<'room_issues'>;

// Recurring schedule from database
export type RecurringSchedule = Tables<'recurring_schedules'>;

// Schedule break from database
export type ScheduleBreak = Tables<'schedule_breaks'>;

// Form data for creating a reservation
export interface CreateReservationInput {
  room_id: string;
  title: string; // Also serves as reason (simplified)
  person_count: number;
  start_time: string;
  end_time: string;
  is_cowork_open?: boolean;
}

// Form data for updating a reservation
export interface UpdateReservationInput {
  title?: string;
  person_count?: number;
  start_time?: string;
  end_time?: string;
  is_cowork_open?: boolean;
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

// Reservation type labels in Czech
export const RESERVATION_TYPE_LABELS: Record<ReservationType, string> = {
  personal: 'Osobní',
  training_session: 'Training Session',
  houston_calling: 'Houston Calling',
};

// Issue type labels in Czech
export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  locked: 'Zamčená místnost',
  mess: 'Nepořádek',
  technical: 'Technický problém',
  other: 'Jiné',
};
