import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type {
  BirthGivingAssignmentState,
  BirthGivingEvent,
  BirthGivingEventDetail,
  BirthGivingEventIndexItem,
  BirthGivingProfileHistoryItem,
  BirthGivingProfileSummary,
  BirthGivingTeamDetail,
} from "./types";

/**
 * The exact 13 event columns authenticated callers may select directly. The
 * seven `assignment_*` columns were revoked in Task 5 and are reachable only
 * through `birth_giving_get_visible_assignment` (embargoed). Every event read
 * query must use this projection so the app stays in sync with the DB column
 * grants (paired by `birth-giving-authorization.int.test.ts`).
 */
export const BIRTH_GIVING_SAFE_EVENT_COLUMNS = [
  "id",
  "name",
  "customer",
  "starts_at",
  "duration",
  "status",
  "organizer_profile_ids",
  "removed_at",
  "removed_by_profile_id",
  "created_at",
  "updated_at",
  "created_by_profile_id",
  "updated_by_profile_id",
] as const;

export type BirthGivingSafeEventKey = (typeof BIRTH_GIVING_SAFE_EVENT_COLUMNS)[number];

type BirthGivingSafeEventRow = Pick<BirthGivingEvent, BirthGivingSafeEventKey>;

/**
 * Redacted assignment metadata served on list/history rows, where the
 * per-row visibility RPC is never called (N+1). The RPC returns the same
 * blurred row to a non-organizer before `starts_at`, so this matches the
 * DB-visible default exactly.
 */
export interface BirthGivingRedactedAssignment {
  assignment_state: BirthGivingAssignmentState;
  assignment_storage_path: string | null;
  assignment_file_name: string | null;
  assignment_mime_type: string | null;
  assignment_file_size: number | null;
  assignment_uploaded_at: string | null;
  assignment_uploaded_by_profile_id: string | null;
}

export const BIRTH_GIVING_REDACTED_ASSIGNMENT: BirthGivingRedactedAssignment = {
  assignment_state: "none",
  assignment_storage_path: null,
  assignment_file_name: null,
  assignment_mime_type: null,
  assignment_file_size: null,
  assignment_uploaded_at: null,
  assignment_uploaded_by_profile_id: null,
};

/**
 * Row shape returned by `birth_giving_get_visible_assignment`. PostgREST
 * serializes `bigint` as a string, so `assignment_file_size` may arrive as
 * either; callers normalize it to `number | null`.
 */
interface VisibleAssignmentRow {
  assignment_state: BirthGivingAssignmentState;
  assignment_storage_path: string | null;
  assignment_file_name: string | null;
  assignment_mime_type: string | null;
  assignment_file_size: string | number | null;
  assignment_uploaded_at: string | null;
  assignment_uploaded_by_profile_id: string | null;
}

/**
 * The committed visibility RPC is not yet present in the generated
 * `database.types.ts` (Task 10 regenerates them via `db:migrate`). Route
 * handlers use the same narrow adapter in `_shared.ts`; the cast is kept
 * private here so the queries stay fully typed.
 */
type VisibleAssignmentRpcCaller = (
  functionName: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

async function loadVisibleAssignment(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<VisibleAssignmentRow | null> {
  const rpc = supabase.rpc as unknown as VisibleAssignmentRpcCaller;
  const { data, error } = await rpc("birth_giving_get_visible_assignment", {
    p_event_id: eventId,
  });
  if (error) throw error;

  // PostgREST returns a RETURNS TABLE result as an array; accept a single
  // object defensively and take the first row.
  if (Array.isArray(data)) {
    return (data[0] as VisibleAssignmentRow | undefined) ?? null;
  }
  return (data as VisibleAssignmentRow | null | undefined) ?? null;
}

function toAssignmentFields(
  visible: VisibleAssignmentRow | null,
): BirthGivingRedactedAssignment {
  if (!visible) return BIRTH_GIVING_REDACTED_ASSIGNMENT;

  return {
    assignment_state: visible.assignment_state,
    assignment_storage_path: visible.assignment_storage_path,
    assignment_file_name: visible.assignment_file_name,
    assignment_mime_type: visible.assignment_mime_type,
    assignment_file_size:
      visible.assignment_file_size === null || visible.assignment_file_size === undefined
        ? null
        : Number(visible.assignment_file_size),
    assignment_uploaded_at: visible.assignment_uploaded_at ?? null,
    assignment_uploaded_by_profile_id: visible.assignment_uploaded_by_profile_id ?? null,
  };
}

export async function listBirthGivingEvents(
  supabase: SupabaseClient<Database>,
): Promise<BirthGivingEventIndexItem[]> {
  const { data, error } = await supabase
    .from("birth_giving_events")
    .select(`
      ${BIRTH_GIVING_SAFE_EVENT_COLUMNS.join(", ")},
      teams:birth_giving_teams(
        id,
        cancelled_at,
        members:birth_giving_team_members(profile_id)
      )
    `)
    .is("removed_at", null)
    .order("starts_at", { ascending: false });

  if (error) throw error;

  interface RawTeamWithMembers {
    id: string;
    cancelled_at: string | null;
    members: { profile_id: string }[];
  }

  interface RawEventWithTeams extends BirthGivingSafeEventRow {
    teams: RawTeamWithMembers[];
  }

  const rows = (data ?? []) as unknown as RawEventWithTeams[];

  return rows.map((raw) => {
    const activeTeams = (raw.teams ?? []).filter((t) => !t.cancelled_at);
    const participantIds = Array.from(
      new Set(activeTeams.flatMap((t) => (t.members ?? []).map((m) => m.profile_id))),
    );

    return {
      ...raw,
      ...BIRTH_GIVING_REDACTED_ASSIGNMENT,
      team_count: activeTeams.length,
      participant_count: participantIds.length,
      participant_profile_ids: participantIds,
    };
  });
}

export async function getBirthGivingEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<BirthGivingEventDetail | null> {
  const { data: rawEvent, error } = await supabase
    .from("birth_giving_events")
    .select(`
      ${BIRTH_GIVING_SAFE_EVENT_COLUMNS.join(", ")},
      teams:birth_giving_teams(
        *,
        members:birth_giving_team_members(
          *,
          profile:profiles(id, name, picture)
        )
      )
    `)
    .eq("id", eventId)
    .is("removed_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!rawEvent) return null;

  interface RawEventWithTeams extends BirthGivingSafeEventRow {
    teams: BirthGivingTeamDetail[];
  }

  const raw = rawEvent as unknown as RawEventWithTeams;

  // The assignment is embargoed from the table projection; fetch the visible
  // metadata exactly once through the visibility RPC and merge it.
  const visibleAssignment = await loadVisibleAssignment(supabase, eventId);

  // Fetch organizer profiles
  let organizers: BirthGivingProfileSummary[] = [];
  if (raw.organizer_profile_ids && raw.organizer_profile_ids.length > 0) {
    const { data: orgData } = await supabase
      .from("profiles")
      .select("id, name, picture")
      .in("id", raw.organizer_profile_ids);
    organizers = (orgData ?? []) as BirthGivingProfileSummary[];
  }

  return {
    ...raw,
    ...toAssignmentFields(visibleAssignment),
    organizers,
    teams: raw.teams ?? [],
  };
}

export async function listBirthGivingOrganizerProfiles(
  supabase: SupabaseClient<Database>,
): Promise<BirthGivingProfileSummary[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, picture")
    .is("access_removed_at", null)
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listProfileBirthGivingHistory(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<BirthGivingProfileHistoryItem[]> {
  const { data, error } = await supabase
    .from("birth_giving_team_members")
    .select(`
      *,
      team:birth_giving_teams!inner(
        id,
        name,
        is_winner,
        cancelled_at,
        event:birth_giving_events!inner(${BIRTH_GIVING_SAFE_EVENT_COLUMNS.join(", ")})
      )
    `)
    .eq("profile_id", profileId);

  if (error) throw error;

  interface HistoryRow {
    team: {
      id: string;
      name: string;
      is_winner: boolean;
      cancelled_at: string | null;
      event: BirthGivingSafeEventRow;
    };
    [key: string]: unknown;
  }

  const rows = (data ?? []) as unknown as HistoryRow[];
  const validRows = rows.filter(
    (row) =>
      !row.team.cancelled_at &&
      row.team.event &&
      row.team.event.status === "published" &&
      !row.team.event.removed_at,
  );

  return validRows
    .map((row) => ({
      ...row.team.event,
      ...BIRTH_GIVING_REDACTED_ASSIGNMENT,
      membership: row as unknown as BirthGivingProfileHistoryItem["membership"],
      team: {
        id: row.team.id,
        name: row.team.name,
        is_winner: row.team.is_winner,
      },
      organizers: [],
    }))
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
}

export async function countProfileBirthGivingParticipations(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("birth_giving_team_members")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (error) throw error;
  return count ?? 0;
}