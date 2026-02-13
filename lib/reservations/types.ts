/**
 * Type definitions for the reservation system
 */

// Database enum types
export type ReservationType = 'personal' | 'training_session' | 'houston_calling';
export type IssueType = 'locked' | 'mess' | 'technical' | 'other';
export type IssueStatus = 'open' | 'resolved';
export type ScheduleBreakType = 'days_of_joy' | 'holiday' | 'other';
export type ReservationStatus = 'active' | 'cancelled';

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
  reservation_type: ReservationType;
  title: string;
  reason: string | null;
  person_count: number | null;
  start_time: string;
  end_time: string;
  is_cowork_open: boolean;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
}

// Reservation with joined data for display
export interface ReservationWithDetails extends Reservation {
  room?: Room;
  user?: {
    id: string;
    name: string;
  };
  team?: {
    id: string;
    name: string;
    year: number;
    color: string | null;
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

// Training Session from database
export interface TrainingSession {
  id: string;
  reservation_id: string;
  team_id: string;
  topic: string;
  cross_slots_available: number;
  prep_file_key: string | null;
  prep_file_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Training Session with details
export interface TrainingSessionWithDetails extends TrainingSession {
  reservation?: Reservation;
  team?: {
    id: string;
    name: string;
    year: number;
    color: string | null;
  };
  facilitators?: {
    id: string;
    user_id: string;
    user?: {
      id: string;
      name: string;
      picture: string | null;
    };
  }[];
  cross_participants?: {
    id: string;
    user_id: string;
    joined_at: string;
    user?: {
      id: string;
      name: string;
      picture: string | null;
    };
  }[];
}

// Houston Calling Event from database
export interface HoustonCallingEvent {
  id: string;
  reservation_id: string;
  team_id: string;
  topic: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Houston Calling Event with details
export interface HoustonCallingEventWithDetails extends HoustonCallingEvent {
  reservation?: Reservation;
  team?: {
    id: string;
    name: string;
    year: number;
  };
}

// Training Session Facilitator
export interface TrainingSessionFacilitator {
  id: string;
  training_session_id: string;
  user_id: string;
  created_at: string;
}

// Training Session Cross Participant
export interface TrainingSessionCrossParticipant {
  id: string;
  training_session_id: string;
  user_id: string;
  joined_at: string;
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

// Form data for creating a training session
export interface CreateTrainingSessionInput {
  room_id: string;
  team_id: string;
  topic: string;
  start_time: string;
  end_time?: string; // Optional, defaults to start_time + 4 hours
  cross_slots_available: number;
  facilitator_ids: string[]; // Array of user IDs
}

// Form data for updating a training session
export interface UpdateTrainingSessionInput {
  topic?: string;
  start_time?: string;
  end_time?: string;
  cross_slots_available?: number;
  facilitator_ids?: string[];
}

// Form data for creating a Houston Calling event
export interface CreateHoustonCallingInput {
  room_id: string;
  team_id: string;
  topic: string;
  start_time: string; // Will auto-set end_time to +4 hours
}

// Form data for updating a Houston Calling event
export interface UpdateHoustonCallingInput {
  topic?: string;
  start_time?: string;
}

// Form data for updating a reservation
export interface UpdateReservationInput {
  title?: string;
  reason?: string;
  person_count?: number;
  start_time?: string;
  end_time?: string;
  is_cowork_open?: boolean;
  status?: ReservationStatus;
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
