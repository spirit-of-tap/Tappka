import { describe, expect, it } from "vitest";

import {
  DECLINE_REASK_MS,
  GRANT_VALID_MS,
  shouldAskConsent,
} from "./consent";

const NOW = 1_800_000_000_000;

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("shouldAskConsent", () => {
  it("asks when status is pending", () => {
    expect(shouldAskConsent("pending", NOW, memoryStorage())).toBe(true);
  });

  it("asks when no timestamp exists", () => {
    const storage = memoryStorage();
    expect(shouldAskConsent("granted", NOW, storage)).toBe(true);
    expect(shouldAskConsent("denied", NOW, storage)).toBe(true);
  });

  it("respects 12-month grant and 6-month decline windows", () => {
    const grantFresh = memoryStorage({
      "tappka-consent-at": String(NOW - GRANT_VALID_MS + 1),
    });
    expect(shouldAskConsent("granted", NOW, grantFresh)).toBe(false);
    const grantStale = memoryStorage({
      "tappka-consent-at": String(NOW - GRANT_VALID_MS - 1),
    });
    expect(shouldAskConsent("granted", NOW, grantStale)).toBe(true);

    const declineFresh = memoryStorage({
      "tappka-consent-at": String(NOW - DECLINE_REASK_MS + 1),
    });
    expect(shouldAskConsent("denied", NOW, declineFresh)).toBe(false);
    const declineStale = memoryStorage({
      "tappka-consent-at": String(NOW - DECLINE_REASK_MS - 1),
    });
    expect(shouldAskConsent("denied", NOW, declineStale)).toBe(true);
  });
});
