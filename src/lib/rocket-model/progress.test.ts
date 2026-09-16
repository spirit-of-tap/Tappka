import { describe, expect, it } from "vitest";

import {
  calculateTeamProgressStats,
  canCheckAsTeam,
  coveragePercent,
  getMissingMembers,
  isUnanimous,
  needsReconfirmation,
} from "./progress";

describe("coveragePercent", () => {
  it("returns 0 when there is nothing to cover", () => {
    expect(coveragePercent(0, 0)).toBe(0);
  });

  it("rounds coverage to whole percent", () => {
    expect(coveragePercent(5, 7)).toBe(71);
    expect(coveragePercent(1, 3)).toBe(33);
    expect(coveragePercent(7, 7)).toBe(100);
  });
});

describe("isUnanimous", () => {
  it("requires at least one member and full coverage", () => {
    expect(isUnanimous(0, 0)).toBe(false);
    expect(isUnanimous(3, 3)).toBe(true);
    expect(isUnanimous(2, 3)).toBe(false);
  });
});

describe("canCheckAsTeam", () => {
  it("unlocks the team check only on unanimity", () => {
    expect(canCheckAsTeam(7, 7)).toBe(true);
    expect(canCheckAsTeam(6, 7)).toBe(false);
    expect(canCheckAsTeam(0, 0)).toBe(false);
  });
});

describe("needsReconfirmation", () => {
  it("flags a checked team item that lost unanimity (e.g. newcomer)", () => {
    expect(needsReconfirmation(true, true)).toBe(false);
    expect(needsReconfirmation(true, false)).toBe(true);
    expect(needsReconfirmation(false, false)).toBe(false);
  });
});

describe("calculateTeamProgressStats", () => {
  it("calculates team metrics accurately", () => {
    const items = [
      { id: "item-1" },
      { id: "item-2" },
      { id: "item-3" },
      { id: "item-4" },
    ];
    // item-1: unanimous and checked by team -> confirmed
    // item-2: unanimous and NOT checked by team -> ready to confirm
    // item-3: NOT unanimous, but was checked by team -> reconfirmation needed
    // item-4: NOT unanimous, NOT checked by team -> in progress
    const teamChecksByItem = new Map([
      ["item-1", { item_id: "item-1", is_checked: true }],
      ["item-3", { item_id: "item-3", is_checked: true }],
    ]);
    const checkedByItem = new Map([
      ["item-1", new Set(["u1", "u2"])],
      ["item-2", new Set(["u1", "u2"])],
      ["item-3", new Set(["u1"])],
      ["item-4", new Set<string>()],
    ]);
    const memberCount = 2;

    const stats = calculateTeamProgressStats(
      items.map((i) => i.id),
      teamChecksByItem,
      checkedByItem,
      memberCount,
    );

    expect(stats).toEqual({
      totalItems: 4,
      teamCheckedCount: 2,
      teamCheckedPercent: 50,
      readyToConfirmCount: 1,
      reconfirmationCount: 1,
      inProgressCount: 1,
    });
  });
});

describe("getMissingMembers", () => {
  it("returns members who have not checked the item", () => {
    const members = [
      { id: "m1", name: "Alice", picture: null, role: "student" },
      { id: "m2", name: "Bob", picture: null, role: "student" },
      { id: "m3", name: "Charlie", picture: null, role: "student" },
    ];
    const checked = new Set(["m1", "m3"]);
    const missing = getMissingMembers(members, checked);
    expect(missing).toEqual([{ id: "m2", name: "Bob", picture: null, role: "student" }]);
  });
});



