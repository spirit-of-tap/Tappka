const CONSENT_AT_KEY = "tappka-consent-at";

const DAY_MS = 24 * 60 * 60 * 1000;
// Per ÚOOÚ guidance: consent valid ~12 months, re-ask at the earliest
// 6 months after a refusal.
export const GRANT_VALID_MS = 365 * DAY_MS;
export const DECLINE_REASK_MS = 6 * 30 * DAY_MS;

interface ConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): ConsentStorage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readConsentAt(
  now: number = Date.now(),
  storage: ConsentStorage | null = defaultStorage(),
): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CONSENT_AT_KEY);
    if (!raw) return null;
    const at = Number(raw);
    return Number.isFinite(at) && at <= now ? at : null;
  } catch {
    return null;
  }
}

export function recordConsentChoice(
  now: number = Date.now(),
  storage: ConsentStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(CONSENT_AT_KEY, String(now));
  } catch {
    // storage unavailable — consent choice itself is still persisted by PostHog
  }
}

/**
 * Whether the banner should ask. Re-asks when the previous choice expired
 * (12 months grant / 6 months decline) or when no timestamp exists, since
 * the operator must be able to prove when consent was given.
 */
export function shouldAskConsent(
  status: string,
  now: number = Date.now(),
  storage: ConsentStorage | null = defaultStorage(),
): boolean {
  if (status === "pending") return true;
  const at = readConsentAt(now, storage);
  if (at == null) return true;
  if (status === "granted") return now - at > GRANT_VALID_MS;
  return now - at > DECLINE_REASK_MS;
}
