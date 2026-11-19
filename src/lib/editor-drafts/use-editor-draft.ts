'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { moveDraft, readDraft, removeDraft, writeDraft, type EditorDraft } from './draft-storage';

export const WRITE_DEBOUNCE_MS = 1000;

export interface UseEditorDraftResult<T> {
  /** The hydrated draft (TTL-checked), or null when nothing is stored. */
  draft: EditorDraft<T> | null;
  /** Schedules a debounced write of the latest payload. */
  update: (payload: T) => void;
  /** Writes the pending payload immediately (pagehide safety net). */
  flush: () => void;
  /** Clears the stored draft and any pending write. */
  discard: () => void;
  /** Moves the stored draft to a new scope; future writes go there too. */
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
  scopeRef.current = scope;

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
      writeDraft(window.localStorage, scopeRef.current, pending);
    }, WRITE_DEBOUNCE_MS);
  }, [clearTimer]);

  const flush = useCallback(() => {
    clearTimer();
    const pending = pendingRef.current;
    if (pending === null) return;
    writeDraft(window.localStorage, scopeRef.current, pending);
  }, [clearTimer]);

  const discard = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    removeDraft(window.localStorage, scopeRef.current);
    setDraft(null);
  }, [clearTimer]);

  const migrate = useCallback((nextScope: string) => {
    if (nextScope === scopeRef.current) return;
    moveDraft(window.localStorage, scopeRef.current, nextScope);
    scopeRef.current = nextScope;
  }, []);

  // Hydrate on mount / scope change.
  useEffect(() => {
    const stored = readDraft<T>(window.localStorage, scope);
    if (stored !== null) setDraft(stored);
  }, [scope]);

  // Last-chance flush when the page is hidden or unloaded.
  useEffect(() => {
    const onHide = () => {
      clearTimer();
      const pending = pendingRef.current;
      if (pending === null) return;
      writeDraft(window.localStorage, scopeRef.current, pending);
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

  return { draft, update, flush, discard, migrate };
}
