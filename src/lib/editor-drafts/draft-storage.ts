/**
 * Pure localStorage helpers for editor drafts. All reads and writes go
 * through here so the hook stays thin and every rule (TTL, shape, key
 * prefix) lives in one testable place. Reads lazily remove expired or
 * corrupt entries instead of merely hiding them.
 */

export const DRAFT_KEY_PREFIX = 'tappka:draft:';
export const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface EditorDraft<T> {
  savedAt: string;
  payload: T;
}

export function buildDraftKey(scope: string): string {
  return `${DRAFT_KEY_PREFIX}${scope}`;
}

/** Returns true when the timestamp is unparseable or older than the TTL. */
export function isDraftExpired(savedAt: string, now = Date.now()): boolean {
  const timestamp = Date.parse(savedAt);
  if (Number.isNaN(timestamp)) return true;
  return now - timestamp > DRAFT_TTL_MS;
}

/**
 * A draft is worth offering only when there is no server copy or the server
 * copy is older. Unparseable server timestamps fail open (offer the draft).
 */
export function isDraftNewerThan(draft: EditorDraft<unknown>, serverTime: string | null): boolean {
  if (serverTime === null) return true;
  const serverTimestamp = Date.parse(serverTime);
  if (Number.isNaN(serverTimestamp)) return true;
  return Date.parse(draft.savedAt) > serverTimestamp;
}

/** Best-effort removal; storage errors are swallowed. */
function safeRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Storage disabled.
  }
}

/** Safely returns window.localStorage, or null when the getter itself throws. */
export function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads and shape-checks a draft; expired, corrupt or malformed entries are
 * removed from storage. The payload is not validated beyond the
 * savedAt/payload shape — callers must treat it as untrusted.
 */
export function readDraft<T>(storage: Storage, scope: string): EditorDraft<T> | null {
  const key = buildDraftKey(scope);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; payload?: unknown };
    if (typeof parsed !== 'object' || parsed === null) {
      safeRemove(storage, key);
      return null;
    }
    if (typeof parsed.savedAt !== 'string' || !('payload' in parsed)) {
      safeRemove(storage, key);
      return null;
    }
    if (isDraftExpired(parsed.savedAt)) {
      safeRemove(storage, key);
      return null;
    }
    // The shape check guarantees savedAt/payload exist; the payload content
    // itself may not match T, so callers must treat it as untrusted.
    return { savedAt: parsed.savedAt, payload: parsed.payload as T };
  } catch {
    // Corrupt JSON — remove the entry and treat as no draft.
    safeRemove(storage, key);
    return null;
  }
}

/** Writes a draft; quota or storage errors are swallowed (recovery degrades silently). */
export function writeDraft<T>(storage: Storage, scope: string, payload: T): EditorDraft<T> {
  const draft: EditorDraft<T> = { savedAt: new Date().toISOString(), payload };
  try {
    storage.setItem(buildDraftKey(scope), JSON.stringify(draft));
  } catch {
    // Quota exceeded or storage disabled.
  }
  return draft;
}

export function removeDraft(storage: Storage, scope: string): void {
  safeRemove(storage, buildDraftKey(scope));
}

/** Moves a stored draft between scopes; a no-op when nothing is stored. */
export function moveDraft(storage: Storage, fromScope: string, toScope: string): void {
  if (fromScope === toScope) return;
  try {
    const fromKey = buildDraftKey(fromScope);
    const raw = storage.getItem(fromKey);
    if (raw === null) return;
    storage.setItem(buildDraftKey(toScope), raw);
    storage.removeItem(fromKey);
  } catch {
    // Storage disabled.
  }
}
