/**
 * Type definitions for the reservation system
 */

// Database enum types
export type ReservationType = 'personal' | 'training_session' | 'houston_calling';
export type IssueType = 'locked' | 'mess' | 'technical' | 'other';
export type IssueStatus = 'open' | 'resolved';
export type ScheduleBreakType = 'days_of_joy' | 'holiday' | 'other';

// Room from database
export interface Room {
  id: string;
  code: string;
  name: string;
  description: string | null;
  available_days: number[] | null;
  can_have_ts: boolean;
  created_at: string;
}

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
export interface Reservation {
  id: string;
  room_id: string;
  user_id: string | null;
  team_id: string | null;
  recurring_schedule_id: string | null;
  reservation_type: ReservationType;
  title: string;
  person_count: number | null;
  start_time: string;
  end_time: string;
  is_cowork_open: boolean;
  created_at: string;
  updated_at: string;
}

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

// Cowork participant
export interface CoworkParticipant {
  id: string;
  reservation_id: string;
  user_id: string;
  joined_at: string;
  user?: {
    id: string;
    name: string;
  };
}

// Room issue from database
export interface RoomIssue {
  id: string;
  room_id: string;
  reported_by: string | null;
  issue_type: IssueType;
  description: string | null;
  status: IssueStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

// Recurring schedule from database
export interface RecurringSchedule {
  id: string;
  room_id: string;
  team_id: string;
  created_by: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  valid_from: string;
  valid_until: string;
  created_at: string;
}

// Schedule break from database
export interface ScheduleBreak {
  id: string;
  break_type: ScheduleBreakType;
  name: string;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
}

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

export const MAX_ADVANCE_BOOKING_DAYS = 14; // 2 weeks
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
