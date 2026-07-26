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
