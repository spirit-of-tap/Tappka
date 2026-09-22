import { describe, expect, it } from "vitest";

import {
  calculateRocketRadarData,
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

describe("calculateRocketRadarData", () => {
  it("calculates radar metrics per category sorted by order_index", () => {
    const categories = [
      {
        id: "cat-2",
        code: "J1",
        title: "J1 - Process",
        order_index: 1,
        is_active: true,
        created_at: "",
        updated_at: "",
        items: [
          {
            id: "j-1",
            category_id: "cat-2",
            order_index: 0,
            text_cs: "Item J1",
            is_active: true,
            created_at: "",
            updated_at: "",
          },
        ],
      },
      {
        id: "cat-1",
        code: "Y1",
        title: "Y1 - Process",
        order_index: 0,
        is_active: true,
        created_at: "",
        updated_at: "",
        items: [
          {
            id: "y-1",
            category_id: "cat-1",
            order_index: 0,
            text_cs: "Item Y1",
            is_active: true,
            created_at: "",
            updated_at: "",
          },
          {
            id: "y-2",
            category_id: "cat-1",
            order_index: 1,
            text_cs: "Item Y2",
            is_active: true,
            created_at: "",
            updated_at: "",
          },
        ],
      },
    ];

    const teamMembers = [
      { id: "m1", name: "Member 1", picture: null, role: "student" },
      { id: "m2", name: "Member 2", picture: null, role: "student" },
    ];

    // Y1: y-1 is checked by m1 and m2 (unanimous) and confirmed by team.
    //     y-2 is checked only by m1 (not unanimous) and NOT confirmed.
    // J1: j-1 is checked by no one.
    const states = [
      { item_id: "y-1", profile_id: "m1", is_checked: true, created_at: "", updated_at: "" },
      { item_id: "y-1", profile_id: "m2", is_checked: true, created_at: "", updated_at: "" },
      { item_id: "y-2", profile_id: "m1", is_checked: true, created_at: "", updated_at: "" },
    ];

    const teamChecks = [
      { team_id: "t1", item_id: "y-1", is_checked: true, checked_by_profile_id: "m1", created_at: "", updated_at: "" },
    ];

    const radar = calculateRocketRadarData(categories, teamMembers, states, teamChecks);

    expect(radar).toHaveLength(2);
    // Verified sorting by order_index: Y1 first, then J1
    expect(radar[0].code).toBe("Y1");
    expect(radar[0].totalItems).toBe(2);
    expect(radar[0].teamCheckedCount).toBe(1);
    expect(radar[0].teamCheckedPercent).toBe(50); // 1 of 2
    expect(radar[0].unanimousCount).toBe(1);
    expect(radar[0].unanimousPercent).toBe(50); // 1 of 2
    expect(radar[0].totalMemberChecks).toBe(3); // 2 on y-1, 1 on y-2
    expect(radar[0].memberAveragePercent).toBe(75); // 3 of (2 items * 2 members = 4) -> 75%

    expect(radar[1].code).toBe("J1");
    expect(radar[1].totalItems).toBe(1);
    expect(radar[1].teamCheckedCount).toBe(0);
    expect(radar[1].teamCheckedPercent).toBe(0);
    expect(radar[1].unanimousCount).toBe(0);
    expect(radar[1].unanimousPercent).toBe(0);
    expect(radar[1].totalMemberChecks).toBe(0);
    expect(radar[1].memberAveragePercent).toBe(0);
  });

  it("handles empty categories or members safely without NaN", () => {
    const radar = calculateRocketRadarData([], [], [], []);
    expect(radar).toEqual([]);

    const emptyItemsCat = [
      {
        id: "cat-empty",
        code: "EMP",
        title: "Empty Category",
        order_index: 0,
        is_active: true,
        created_at: "",
        updated_at: "",
        items: [],
      },
    ];
    const emptyResult = calculateRocketRadarData(emptyItemsCat, [], [], []);
    expect(emptyResult[0].teamCheckedPercent).toBe(0);
    expect(emptyResult[0].memberAveragePercent).toBe(0);
  });
});
