import { calculateEventEnd } from "./time";
import type {
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
      event.organizer_profile_ids?.includes(profileId) ||
      event.participant_profile_ids?.includes(profileId)
    ) {
      mine.push(event);
    }
  }

  upcoming.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  mine.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  history.sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));

  return { upcoming, mine, history };
}

