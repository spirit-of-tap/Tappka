import { describe, expect, it } from "vitest";

import { getDailySeed, getLocalDayKey } from "./daily-seed";

describe("getLocalDayKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(getLocalDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(getLocalDayKey(new Date(2026, 8, 18))).toBe("2026-09-18");
  });
});

describe("getDailySeed", () => {
  it("returns the same seed for different times on the same day", () => {
    const morning = getDailySeed(new Date(2026, 8, 18, 8, 30));
    const evening = getDailySeed(new Date(2026, 8, 18, 22, 15));

    expect(morning).toBe(evening);
  });

  it("returns a different seed for consecutive days", () => {
    const today = getDailySeed(new Date(2026, 8, 18, 12));
    const tomorrow = getDailySeed(new Date(2026, 8, 19, 12));

    expect(today).not.toBe(tomorrow);
  });

  it("defaults to today", () => {
    expect(getDailySeed()).toBe(getDailySeed(new Date()));
  });
});
