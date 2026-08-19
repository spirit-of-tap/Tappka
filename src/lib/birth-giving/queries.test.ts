import { describe, expect, it } from "vitest";

import {
  applyBirthGivingParticipationValidityFilters,
  filterPendingBirthGivingProposals,
} from "./queries";

describe("filterPendingBirthGivingProposals", () => {
  it("keeps only pending proposals for canonical event detail", () => {
    const proposals = [
      { id: "pending", state: "pending" as const },
      { id: "accepted", state: "accepted" as const },
      { id: "rejected", state: "rejected" as const },
      { id: "cancelled", state: "cancelled" as const },
    ];

    expect(filterPendingBirthGivingProposals(proposals)).toEqual([
      { id: "pending", state: "pending" },
    ]);
  });
});

describe("applyBirthGivingParticipationValidityFilters", () => {
  it("applies every production history and count validity predicate", () => {
    const calls: string[] = [];
    const query = {
      not(column: "frozen_at", operator: "is", value: null) {
        calls.push(`not:${column}:${operator}:${String(value)}`);
        return this;
      },
      eq(
        column: "team.status" | "team.event.status",
        value: "confirmed" | "published",
      ) {
        calls.push(`eq:${column}:${value}`);
        return this;
      },
      is(column: "team.event.removed_at", value: null) {
        calls.push(`is:${column}:${String(value)}`);
        return this;
      },
    };

    expect(applyBirthGivingParticipationValidityFilters(query)).toBe(query);
    expect(calls).toEqual([
      "not:frozen_at:is:null",
      "eq:team.status:confirmed",
      "eq:team.event.status:published",
      "is:team.event.removed_at:null",
    ]);
  });
});
