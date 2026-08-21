import { describe, expect, it } from "vitest";

import {
  countValidBirthGivingParticipations,
  groupBirthGivingEvents,
} from "./grouping";

const NOW = new Date("2026-08-19T12:00:00.000Z");

function event(
  id: string,
  startsAt: string,
  options: {
    duration?: "8h" | "24h";
    joiningOpen?: boolean;
    organizerProfileIds?: string[];
    participantProfileIds?: string[];
    pendingProposalProfileIds?: string[];
  } = {},
) {
  return {
    id,
    starts_at: startsAt,
    duration: options.duration ?? "8h",
    joining_open: options.joiningOpen ?? false,
    organizer_profile_ids: options.organizerProfileIds ?? [],
    participant_profile_ids: options.participantProfileIds ?? [],
    pending_proposal_profile_ids: options.pendingProposalProfileIds ?? [],
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

  it("puts open future events first and orders history newest first", () => {
    const grouped = groupBirthGivingEvents(
      [
        event("closed-sooner", "2026-08-20T08:00:00.000Z"),
        event("open-later", "2026-08-21T08:00:00.000Z", { joiningOpen: true }),
        event("older", "2026-08-16T08:00:00.000Z"),
        event("newer", "2026-08-18T08:00:00.000Z"),
      ],
      "profile-1",
      NOW,
    );

    expect(grouped.upcoming.map(({ id }) => id)).toEqual(["open-later", "closed-sooner"]);
    expect(grouped.history.map(({ id }) => id)).toEqual(["newer", "older"]);
  });

  it("does not prioritize a stale open flag after an event has started", () => {
    const grouped = groupBirthGivingEvents(
      [
        event("stale-open-active", "2026-08-19T08:00:00.000Z", { joiningOpen: true }),
        event("open-future", "2026-08-20T08:00:00.000Z", { joiningOpen: true }),
        event("closed-active", "2026-08-19T10:00:00.000Z"),
      ],
      "profile-1",
      NOW,
    );

    expect(grouped.upcoming.map(({ id }) => id)).toEqual([
      "open-future",
      "stale-open-active",
      "closed-active",
    ]);
  });

  it("includes organized, joined, and pending-proposal events in my events once", () => {
    const grouped = groupBirthGivingEvents(
      [
        event("organizer", "2026-08-20T08:00:00.000Z", {
          organizerProfileIds: ["profile-1"],
        }),
        event("member", "2026-08-21T08:00:00.000Z", {
          participantProfileIds: ["profile-1"],
        }),
        event("proposal", "2026-08-22T08:00:00.000Z", {
          pendingProposalProfileIds: ["profile-1"],
        }),
        event("all-three", "2026-08-23T08:00:00.000Z", {
          organizerProfileIds: ["profile-1"],
          participantProfileIds: ["profile-1"],
          pendingProposalProfileIds: ["profile-1"],
        }),
        event("unrelated", "2026-08-24T08:00:00.000Z"),
      ],
      "profile-1",
      NOW,
    );

    expect(grouped.mine.map(({ id }) => id)).toEqual([
      "organizer",
      "member",
      "proposal",
      "all-three",
    ]);
  });
});

describe("countValidBirthGivingParticipations", () => {
  it("counts one frozen membership per published nonremoved event and confirmed team", () => {
    const valid = {
      event_id: "event-1",
      frozen_at: "2026-08-19T08:00:00.000Z",
      event_status: "published" as const,
      event_removed_at: null,
      team_status: "confirmed" as const,
    };

    expect(
      countValidBirthGivingParticipations([
        valid,
        { ...valid },
        { ...valid, event_id: "event-2", frozen_at: null },
        { ...valid, event_id: "event-3", event_status: "draft" },
        { ...valid, event_id: "event-4", event_removed_at: NOW.toISOString() },
        { ...valid, event_id: "event-5", team_status: "cancelled" },
        { ...valid, event_id: "event-6", team_status: "forming" },
        { ...valid, event_id: "event-7" },
      ]),
    ).toBe(2);
  });
});
