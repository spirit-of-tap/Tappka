import { calculateEventEnd } from "./time";
import type {
  BirthGivingParticipationCandidate,
  GroupableBirthGivingEvent,
  GroupedBirthGivingEvents,
} from "./types";

export function groupBirthGivingEvents<T extends GroupableBirthGivingEvent>(
  events: readonly T[],
  profileId: string,
  now: Date,
): GroupedBirthGivingEvents<T> {
  const upcoming: T[] = [];
  const mine: T[] = [];
  const history: T[] = [];

  for (const event of events) {
    const endsAt = calculateEventEnd(new Date(event.starts_at), event.duration);

    if (endsAt.getTime() > now.getTime()) {
      upcoming.push(event);
    } else {
      history.push(event);
    }

    if (
      event.organizer_profile_ids.includes(profileId) ||
      event.participant_profile_ids.includes(profileId) ||
      event.pending_proposal_profile_ids.includes(profileId)
    ) {
      mine.push(event);
    }
  }

  upcoming.sort((left, right) => {
    const leftJoiningOpen = left.joining_open && now.getTime() < Date.parse(left.starts_at);
    const rightJoiningOpen = right.joining_open && now.getTime() < Date.parse(right.starts_at);
    if (leftJoiningOpen !== rightJoiningOpen) {
      return leftJoiningOpen ? -1 : 1;
    }
    return Date.parse(left.starts_at) - Date.parse(right.starts_at);
  });
  mine.sort((left, right) => Date.parse(left.starts_at) - Date.parse(right.starts_at));
  history.sort((left, right) => Date.parse(right.starts_at) - Date.parse(left.starts_at));

  return { upcoming, mine, history };
}

export function countValidBirthGivingParticipations(
  candidates: readonly BirthGivingParticipationCandidate[],
): number {
  const eventIds = new Set<string>();

  for (const candidate of candidates) {
    if (
      candidate.frozen_at !== null &&
      candidate.event_status === "published" &&
      candidate.event_removed_at === null &&
      candidate.team_status === "confirmed"
    ) {
      eventIds.add(candidate.event_id);
    }
  }

  return eventIds.size;
}
