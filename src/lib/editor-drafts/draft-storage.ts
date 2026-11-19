/**
 * Pure localStorage helpers for editor drafts. All reads and writes go
 * through here so the hook stays thin and every rule (TTL, shape, key
 * prefix) lives in one testable place.
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

/** Drops a draft whose timestamp is unparseable or older than the TTL. */
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

/** Reads and shape-checks a draft; expired or corrupt entries are dropped. */
export function readDraft<T>(storage: Storage, scope: string): EditorDraft<T> | null {
  const key = buildDraftKey(scope);
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; payload?: unknown };
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.savedAt !== 'string' || !('payload' in parsed)) return null;
    if (isDraftExpired(parsed.savedAt)) {
      storage.removeItem(key);
      return null;
    }
    return { savedAt: parsed.savedAt, payload: parsed.payload as T };
  } catch {
    // Corrupt JSON or storage disabled — treat as no draft.
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
  try {
    storage.removeItem(buildDraftKey(scope));
  } catch {
    // Storage disabled.
  }
}

/** Moves a stored draft between scopes; a no-op when nothing is stored. */
export function moveDraft(storage: Storage, fromScope: string, toScope: string): void {
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
