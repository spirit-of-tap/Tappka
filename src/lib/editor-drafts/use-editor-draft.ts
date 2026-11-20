'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getLocalStorage, moveDraft, readDraft, removeDraft, writeDraft,
  type EditorDraft,
} from './draft-storage';

export const WRITE_DEBOUNCE_MS = 1000;

export interface UseEditorDraftResult<T> {
  /** The hydrated draft (TTL-checked), or null when nothing is stored. */
  draft: EditorDraft<T> | null;
  /**
   * Schedules a debounced write of the latest payload. T must not be null —
   * null is the "no pending write" sentinel.
   */
  update: (payload: T) => void;
  /** Writes the pending payload immediately (pagehide safety net). */
  flush: () => void;
  /** Clears the stored draft and any pending write. */
  discard: () => void;
  /**
   * Moves the stored draft to a new scope; future writes go there too. The
   * parent is expected to pass the new scope on a subsequent render
   * (re-hydration).
   */
  migrate: (nextScope: string) => void;
}

/**
 * Persists an in-progress editor document to localStorage so an accidentally
 * closed tab can be recovered. Debounced writes keep the storage quiet while
 * typing; `pagehide`/`visibilitychange` listeners flush the last keystrokes
 * on mobile browsers that skip `beforeunload`.
 */
export function useEditorDraft<T>(scope: string): UseEditorDraftResult<T> {
  const [draft, setDraft] = useState<EditorDraft<T> | null>(null);
  const pendingRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeRef = useRef(scope);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const update = useCallback((payload: T) => {
    pendingRef.current = payload;
    clearTimer();
    timerRef.current = setTimeout(() => {
      const pending = pendingRef.current;
      if (pending === null) return;
      pendingRef.current = null;
      const storage = getLocalStorage();
      if (storage !== null) writeDraft(storage, scopeRef.current, pending);
    }, WRITE_DEBOUNCE_MS);
  }, [clearTimer]);

  const flush = useCallback(() => {
    clearTimer();
    const pending = pendingRef.current;
    if (pending === null) return;
    pendingRef.current = null;
    const storage = getLocalStorage();
    if (storage !== null) writeDraft(storage, scopeRef.current, pending);
  }, [clearTimer]);

  const discard = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    const storage = getLocalStorage();
    if (storage !== null) removeDraft(storage, scopeRef.current);
    setDraft(null);
  }, [clearTimer]);

  const migrate = useCallback((nextScope: string) => {
    if (nextScope === scopeRef.current) return;
    const storage = getLocalStorage();
    if (storage !== null) moveDraft(storage, scopeRef.current, nextScope);
    scopeRef.current = nextScope;
  }, []);

  // Hydrate on mount / scope change. The ref sync must live in an effect
  // (react-hooks/refs forbids render access), and setDraft runs
  // unconditionally so moving to a scope with nothing stored clears the
  // previous scope's payload.
  useEffect(() => {
    scopeRef.current = scope;
    const storage = getLocalStorage();
    // Hydrating state from an external store (localStorage) is exactly the
    // "sync with an external system" this rule exists to police, but it has
    // no escape hatch for a one-time mount read; the sanctioned alternative
    // (useSyncExternalStore) cannot express same-tab writes without a manual
    // cache. This runs once per scope change, not on a cascading loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(storage === null ? null : readDraft<T>(storage, scope));
  }, [scope]);

  // Last-chance flush when the page is hidden or unloaded.
  useEffect(() => {
    const onHide = () => {
      clearTimer();
      const pending = pendingRef.current;
      if (pending === null) return;
      pendingRef.current = null;
      const storage = getLocalStorage();
      if (storage !== null) writeDraft(storage, scopeRef.current, pending);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [clearTimer]);

  // SPA navigation unmounts the editor without pagehide — persist on the way out.
  useEffect(() => {
    return () => {
      clearTimer();
      const pending = pendingRef.current;
      if (pending === null) return;
      pendingRef.current = null;
      const storage = getLocalStorage();
      if (storage !== null) writeDraft(storage, scopeRef.current, pending);
    };
  }, [clearTimer]);

  return useMemo(
    () => ({ draft, update, flush, discard, migrate }),
    [draft, update, flush, discard, migrate],
  );
}
