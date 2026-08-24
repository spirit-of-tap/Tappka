import { describe, expect, it } from "vitest";

import { groupBirthGivingEvents } from "./grouping";

const NOW = new Date("2026-08-19T12:00:00.000Z");

function event(
  id: string,
  startsAt: string,
  options: {
    duration?: "8h" | "24h";
    organizerProfileIds?: string[];
    participantProfileIds?: string[];
  } = {},
) {
  return {
    id,
    starts_at: startsAt,
    duration: options.duration ?? "8h",
    organizer_profile_ids: options.organizerProfileIds ?? [],
    participant_profile_ids: options.participantProfileIds ?? [],
  };
}

describe("groupBirthGivingEvents", () => {
  it("keeps future and active events upcoming and moves ended events to history", () => {
    const active = event("active", "2026-08-19T08:00:00.000Z");
    const future = event("future", "2026-08-20T08:00:00.000Z");
    const ended = event("ended", "2026-08-18T08:00:00.000Z");

    const grouped = groupBirthGivingEvents([ended, future, active], "profile-1", NOW);

    expect(grouped.upcoming.map(({ id }) => id)).toEqual(["active", "future"]);
    expect(grouped.history.map(({ id }) => id)).toEqual(["ended"]);
  });

  it("orders history newest first", () => {
    const grouped = groupBirthGivingEvents(
      [
        event("older", "2026-08-16T08:00:00.000Z"),
        event("newer", "2026-08-18T08:00:00.000Z"),
      ],
      "profile-1",
      NOW,
    );

    expect(grouped.history.map(({ id }) => id)).toEqual(["newer", "older"]);
  });

  it("includes organized and joined events in my events once", () => {
    const grouped = groupBirthGivingEvents(
      [
        event("organizer", "2026-08-20T08:00:00.000Z", {
          organizerProfileIds: ["profile-1"],
        }),
        event("member", "2026-08-21T08:00:00.000Z", {
          participantProfileIds: ["profile-1"],
        }),
        event("both", "2026-08-23T08:00:00.000Z", {
          organizerProfileIds: ["profile-1"],
          participantProfileIds: ["profile-1"],
        }),
        event("unrelated", "2026-08-24T08:00:00.000Z"),
      ],
      "profile-1",
      NOW,
    );

    expect(grouped.mine.map(({ id }) => id)).toEqual(["organizer", "member", "both"]);
  });
});
