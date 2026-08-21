import { describe, expect, it } from "vitest";

import {
  normalizeEventIdentity,
  rankDuplicateCandidates,
} from "./identity";

const IDENTITY = {
  eventName: "  Letni   slavnost ",
  customer: " SKODA  AUTO ",
  startsAt: new Date("2026-08-19T08:00:00.000Z"),
};

describe("normalizeEventIdentity", () => {
  it("normalizes the event name, customer, and start timestamp", () => {
    expect(normalizeEventIdentity(IDENTITY)).toEqual({
      eventName: "letni slavnost",
      customer: "skoda auto",
      startsAt: "2026-08-19T08:00:00.000Z",
    });
  });

  it("normalizes compatibility characters consistently", () => {
    expect(
      normalizeEventIdentity({
        ...IDENTITY,
        eventName: "ＢＧ １",
      }).eventName,
    ).toBe("bg 1");
  });
});

describe("rankDuplicateCandidates", () => {
  it("ranks exact and near textual matches before weaker matches", () => {
    const candidates = [
      {
        id: "weak",
        eventName: "Letni slavnost",
        customer: "Jiny zakaznik",
        startsAt: new Date("2026-08-19T08:00:00.000Z"),
      },
      {
        id: "near",
        eventName: "Letni slavnosti",
        customer: "Skoda Auto",
        startsAt: new Date("2026-08-19T08:00:00.000Z"),
      },
      {
        id: "exact",
        eventName: "LETNI SLAVNOST",
        customer: "  skoda auto ",
        startsAt: new Date("2026-08-19T10:00:00.000Z"),
      },
    ];

    expect(rankDuplicateCandidates(IDENTITY, candidates).map(({ id }) => id)).toEqual([
      "exact",
      "near",
      "weak",
    ]);
  });

  it("breaks equal text scores by start proximity and then ID", () => {
    const candidates = [
      {
        id: "b",
        eventName: "Letni slavnost",
        customer: "Skoda Auto",
        startsAt: new Date("2026-08-19T09:00:00.000Z"),
      },
      {
        id: "c",
        eventName: "Letni slavnost",
        customer: "Skoda Auto",
        startsAt: new Date("2026-08-19T08:30:00.000Z"),
      },
      {
        id: "a",
        eventName: "Letni slavnost",
        customer: "Skoda Auto",
        startsAt: new Date("2026-08-19T09:00:00.000Z"),
      },
    ];

    expect(rankDuplicateCandidates(IDENTITY, candidates).map(({ id }) => id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("does not mutate the candidate input", () => {
    const candidates = [
      {
        id: "later",
        eventName: "Letni slavnost",
        customer: "Skoda Auto",
        startsAt: new Date("2026-08-20T08:00:00.000Z"),
      },
      {
        id: "exact",
        eventName: "Letni slavnost",
        customer: "Skoda Auto",
        startsAt: START_DATE,
      },
    ];

    rankDuplicateCandidates(IDENTITY, candidates);

    expect(candidates.map(({ id }) => id)).toEqual(["later", "exact"]);
  });
});

const START_DATE = new Date("2026-08-19T08:00:00.000Z");
