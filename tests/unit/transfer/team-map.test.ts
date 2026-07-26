import { describe, expect, it } from "vitest";

import { buildTeamMap, remapTeamId, type TeamIdentity } from "../../../scripts/transfer/team-map";

const SOURCE: TeamIdentity[] = [
  { id: "l-based", name: "BASED" },
  { id: "l-timace", name: "Timace" },
  { id: "l-jbs", name: "JBS" },
  { id: "l-same", name: "Shared" },
];

const TARGET: TeamIdentity[] = [
  { id: "t-based", name: "BASED" },
  { id: "t-timace", name: "TIMACE" },
  { id: "l-same", name: "Shared" },
];

describe("buildTeamMap", () => {
  it("matches on id when the target already shares the uuid", () => {
    const map = buildTeamMap(SOURCE, TARGET);

    expect(map.byId.get("l-same")).toBe("l-same");
    expect(map.matchedById).toEqual(["l-same"]);
  });

  it("matches on name when the target holds a different uuid", () => {
    expect(buildTeamMap(SOURCE, TARGET).byId.get("l-based")).toBe("t-based");
  });

  it("matches names case-insensitively (Timace vs TIMACE)", () => {
    expect(buildTeamMap(SOURCE, TARGET).byId.get("l-timace")).toBe("t-timace");
  });

  it("reports name matches with both ids", () => {
    expect(buildTeamMap(SOURCE, TARGET).matchedByName).toEqual([
      { name: "BASED", sourceId: "l-based", targetId: "t-based" },
      { name: "Timace", sourceId: "l-timace", targetId: "t-timace" },
    ]);
  });

  it("lists unmatched source teams as missing", () => {
    expect(buildTeamMap(SOURCE, TARGET).missing).toEqual([{ id: "l-jbs", name: "JBS" }]);
  });

  it("maps a missing team to its own id, since it is created with that id", () => {
    expect(buildTeamMap(SOURCE, TARGET).byId.get("l-jbs")).toBe("l-jbs");
  });

  it("resolves every source team", () => {
    const map = buildTeamMap(SOURCE, TARGET);

    for (const team of SOURCE) expect(map.byId.get(team.id)).toBeDefined();
  });

  it("is the identity when target teams are byte-identical", () => {
    const map = buildTeamMap(SOURCE, SOURCE);

    expect(map.missing).toEqual([]);
    expect(map.matchedByName).toEqual([]);
    expect(map.matchedById).toHaveLength(SOURCE.length);
  });

  it("treats every source team as missing when the target has none", () => {
    expect(buildTeamMap(SOURCE, []).missing).toHaveLength(SOURCE.length);
  });

  it("throws when two target teams share a normalized name", () => {
    expect(() =>
      buildTeamMap(SOURCE, [
        { id: "a", name: "Dup" },
        { id: "b", name: " dup " },
      ]),
    ).toThrow(/Ambiguous target teams.*dup/);
  });
});

describe("remapTeamId", () => {
  it("passes null through", () => {
    expect(remapTeamId(buildTeamMap(SOURCE, TARGET), null)).toBeNull();
  });

  it("resolves a known id", () => {
    expect(remapTeamId(buildTeamMap(SOURCE, TARGET), "l-based")).toBe("t-based");
  });

  it("throws on an unknown id rather than writing a dangling FK", () => {
    expect(() => remapTeamId(buildTeamMap(SOURCE, TARGET), "ghost")).toThrow(
      /Unmapped team id "ghost"/,
    );
  });
});
