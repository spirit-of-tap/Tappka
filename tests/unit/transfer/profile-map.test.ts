import { describe, expect, it } from "vitest";

import {
  buildProfileMap,
  remapOptionalProfileId,
  remapProfileId,
} from "../../../scripts/transfer/profile-map";

const SOURCE = [
  { id: "src-kulo", work_email: "xkulo007@studenti.czu.cz" },
  { id: "src-system", work_email: "admin@studenti.czu.cz" },
  { id: "src-other", work_email: "xnovy001@studenti.czu.cz" },
];

const TARGET = [{ id: "tgt-kulo", work_email: "XKulo007@studenti.czu.cz" }];

describe("buildProfileMap", () => {
  it("maps a colliding source id to the existing target id", () => {
    expect(buildProfileMap(SOURCE, TARGET).byId.get("src-kulo")).toBe("tgt-kulo");
  });

  it("maps a non-colliding source id to itself", () => {
    expect(buildProfileMap(SOURCE, TARGET).byId.get("src-other")).toBe("src-other");
  });

  it("matches work_email case-insensitively and ignores surrounding space", () => {
    const map = buildProfileMap(
      [{ id: "s", work_email: " Foo@pef.czu.cz " }],
      [{ id: "t", work_email: "foo@pef.czu.cz" }],
    );

    expect(map.byId.get("s")).toBe("t");
    expect(map.insertIds.has("s")).toBe(false);
  });

  it("lists only non-colliding ids as inserts", () => {
    const { insertIds } = buildProfileMap(SOURCE, TARGET);

    expect([...insertIds].sort()).toEqual(["src-other", "src-system"]);
  });

  it("reports collisions with both ids and the matched email", () => {
    expect(buildProfileMap(SOURCE, TARGET).collisions).toEqual([
      {
        workEmail: "xkulo007@studenti.czu.cz",
        sourceId: "src-kulo",
        targetId: "tgt-kulo",
      },
    ]);
  });

  it("produces no collisions when the target is empty", () => {
    const map = buildProfileMap(SOURCE, []);

    expect(map.collisions).toEqual([]);
    expect(map.insertIds.size).toBe(3);
  });

  it("throws when two target profiles share a normalized email", () => {
    expect(() =>
      buildProfileMap(
        [{ id: "src-1", work_email: "unique@example.com" }],
        [
          { id: "tgt-1", work_email: "foo@example.com" },
          { id: "tgt-2", work_email: "FOO@example.com" },
        ],
      ),
    ).toThrow(/Ambiguous target profiles/);
  });

  it("throws when two source profiles map to the same target id", () => {
    expect(() =>
      buildProfileMap(
        [
          { id: "src-1", work_email: "foo@example.com" },
          { id: "src-2", work_email: "FOO@example.com" },
        ],
        [{ id: "tgt-1", work_email: "foo@example.com" }],
      ),
    ).toThrow(/Ambiguous source profiles/);
  });

  it("allows two source profiles with the same normalized email if neither matches a target", () => {
    const map = buildProfileMap(
      [
        { id: "src-1", work_email: "foo@example.com" },
        { id: "src-2", work_email: "FOO@example.com" },
      ],
      [],
    );

    expect(map.byId.get("src-1")).toBe("src-1");
    expect(map.byId.get("src-2")).toBe("src-2");
    expect([...map.insertIds].sort()).toEqual(["src-1", "src-2"]);
    expect(map.collisions).toEqual([]);
  });
});

describe("remapProfileId", () => {
  it("resolves a known id", () => {
    expect(remapProfileId(buildProfileMap(SOURCE, TARGET), "src-kulo")).toBe("tgt-kulo");
  });

  it("throws on an unknown id rather than passing it through", () => {
    expect(() => remapProfileId(buildProfileMap(SOURCE, TARGET), "ghost")).toThrow(
      /Unmapped profile id "ghost"/,
    );
  });
});

describe("remapOptionalProfileId", () => {
  it("passes null through", () => {
    expect(remapOptionalProfileId(buildProfileMap(SOURCE, TARGET), null)).toBeNull();
  });

  it("resolves a non-null id", () => {
    expect(remapOptionalProfileId(buildProfileMap(SOURCE, TARGET), "src-kulo")).toBe(
      "tgt-kulo",
    );
  });
});
