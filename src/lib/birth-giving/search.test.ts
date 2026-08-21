import { describe, expect, it } from "vitest";

import { normalizeBirthGivingSearchQuery } from "./search";

describe("normalizeBirthGivingSearchQuery", () => {
  it("strips diacritics and lowercases the input", () => {
    expect(normalizeBirthGivingSearchQuery("Žluťoučký Kůň")).toBe("zlutoucky kun");
    expect(normalizeBirthGivingSearchQuery("First BG")).toBe("first bg");
    expect(normalizeBirthGivingSearchQuery("")).toBe("");
  });
});
