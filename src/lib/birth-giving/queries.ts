import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { rankDuplicateCandidates, type EventIdentityInput } from "./identity";
import type {
  BirthGivingEvent,
  BirthGivingEventDetail,
  BirthGivingEventIndexItem,
  BirthGivingProfileHistoryItem,
  BirthGivingProfileSummary,
  BirthGivingProposalState,
  BirthGivingTeamStatus,
} from "./types";

const DUPLICATE_SEARCH_WINDOW_DAYS = 14;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const EVENT_INDEX_SELECT = `
  *,
  organizers:birth_giving_event_organizers(profile_id),
  teams:birth_giving_teams(
    id,
    status,
    members:birth_giving_team_members(profile_id),
    proposals:birth_giving_team_proposals(candidate_profile_id, state)
  )
`;

const EVENT_DETAIL_SELECT = `
  *,
  assignment:birth_giving_assignments(*),
  organizers:birth_giving_event_organizers(*, profile:profiles!birth_giving_event_organizers_profile_id_fkey(id, name, picture)),
  teams:birth_giving_teams(
    *,
    members:birth_giving_team_members(
      *,
      profile:profiles!birth_giving_team_members_profile_id_fkey(id, name, picture),
      reflection:birth_giving_reflections(*)
    ),
    proposals:birth_giving_team_proposals(
      *,
      candidate:profiles!birth_giving_team_proposals_candidate_profile_id_fkey(id, name, picture),
      initiator:profiles!birth_giving_team_proposals_initiated_by_profile_id_fkey(id, name, picture)
    ),
    result_files:birth_giving_team_result_files(*)
  ),
  team_searches:birth_giving_looking_for_team(*, profile:profiles!birth_giving_looking_for_team_profile_id_fkey(id, name, picture))
`;

interface EventIndexQueryRow extends BirthGivingEvent {
  organizers: { profile_id: string }[];
  teams: {
    id: string;
    status: BirthGivingTeamStatus;
    members: { profile_id: string }[];
    proposals: { candidate_profile_id: string; state: BirthGivingProposalState }[];
  }[];
}

export async function listBirthGivingEvents(
  supabase: SupabaseClient<Database>,
): Promise<BirthGivingEventIndexItem[]> {
  const { data, error } = await supabase
    .from("birth_giving_events")
    .select(EVENT_INDEX_SELECT)
    .eq("status", "published")
    .is("removed_at", null)
    .order("starts_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as EventIndexQueryRow[]).map((event) => {
    const teams = event.teams.filter(({ status }) => status !== "cancelled");
    const participantProfileIds = new Set(
      teams.flatMap(({ members }) => members.map(({ profile_id }) => profile_id)),
    );
    const pendingProposalProfileIds = teams.flatMap(({ proposals }) =>
      proposals
        .filter(({ state }) => state === "pending")
        .map(({ candidate_profile_id }) => candidate_profile_id),
    );
    const { organizers, teams: _teams, ...row } = event;

    return {
      ...row,
      organizer_profile_ids: organizers.map(({ profile_id }) => profile_id),
      participant_profile_ids: [...participantProfileIds],
      pending_proposal_profile_ids: [...new Set(pendingProposalProfileIds)],
      team_count: teams.length,
      participant_count: participantProfileIds.size,
    };
  });
}

export async function getBirthGivingEvent(
  supabase: SupabaseClient<Database>,
  eventId: string,
): Promise<BirthGivingEventDetail | null> {
  const { data, error } = await supabase
    .from("birth_giving_events")
    .select(EVENT_DETAIL_SELECT)
    .eq("id", eventId)
    .is("removed_at", null)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as BirthGivingEventDetail | null;
}

export async function findBirthGivingDuplicateCandidates(
  supabase: SupabaseClient<Database>,
  identity: EventIdentityInput,
): Promise<BirthGivingEvent[]> {
  const windowMilliseconds = DUPLICATE_SEARCH_WINDOW_DAYS * MILLISECONDS_PER_DAY;
  const startsAt = identity.startsAt.getTime();
  const { data, error } = await supabase
    .from("birth_giving_events")
    .select("*")
    .is("removed_at", null)
    .gte("starts_at", new Date(startsAt - windowMilliseconds).toISOString())
    .lte("starts_at", new Date(startsAt + windowMilliseconds).toISOString());

  if (error) throw error;

  const events = data ?? [];
  const ranked = rankDuplicateCandidates(
    identity,
    events.map((event) => ({
      event,
      id: event.id,
      eventName: event.name,
      customer: event.customer,
      startsAt: new Date(event.starts_at),
    })),
  );

  return ranked.map(({ event }) => event);
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
        status,
        event:birth_giving_events!inner(*)
      )
    `)
    .eq("profile_id", profileId)
    .not("frozen_at", "is", null)
    .eq("team.status", "confirmed")
    .eq("team.event.status", "published")
    .is("team.event.removed_at", null)
    .order("confirmed_at", { ascending: false });

  if (error) throw error;

  interface HistoryQueryRow {
    team: {
      id: string;
      name: string;
      status: BirthGivingTeamStatus;
      event: BirthGivingEvent;
    };
  }

  return ((data ?? []) as unknown as HistoryQueryRow[])
    .map(({ team, ...membership }) => ({
      ...team.event,
      membership: membership as BirthGivingProfileHistoryItem["membership"],
      team: { id: team.id, name: team.name, status: team.status },
    }))
    .sort((left, right) => Date.parse(right.starts_at) - Date.parse(left.starts_at));
}

export async function countProfileBirthGivingParticipations(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("birth_giving_team_members")
    .select(
      "event_id, team:birth_giving_teams!inner(status, event:birth_giving_events!inner(status, removed_at))",
      { count: "exact", head: true },
    )
    .eq("profile_id", profileId)
    .not("frozen_at", "is", null)
    .eq("team.status", "confirmed")
    .eq("team.event.status", "published")
    .is("team.event.removed_at", null);

  if (error) throw error;
  return count ?? 0;
}
