import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import type { OverlappingReservation } from "./types";

interface FindOwnOverlappingReservationsParams {
  profileId: string;
  startAt: string;
  endAt: string;
  /** Reservation to ignore, used when editing an existing reservation. */
  excludeReservationId?: string;
}

/**
 * Find the current user's other active reservations that overlap a time range.
 *
 * Overlapping reservations in different rooms are allowed; this lookup feeds a
 * non-blocking warning, never a rejection.
 */
export async function findOwnOverlappingReservations(
  supabase: SupabaseClient<Database>,
  {
    profileId,
    startAt,
    endAt,
    excludeReservationId,
  }: FindOwnOverlappingReservationsParams,
): Promise<OverlappingReservation[]> {
  let query = supabase
    .from("reservations")
    .select("id, title, room:rooms(name)")
    .eq("owner_profile_id", profileId)
    .is("cancelled_at", null)
    .lt("start_at", endAt)
    .gt("end_at", startAt);

  if (excludeReservationId) {
    query = query.neq("id", excludeReservationId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    room_name: row.room?.name ?? null,
  }));
}
