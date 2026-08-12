import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';

/** Quiet period after the last keystroke before a save fires. */
const AUTOSAVE_DEBOUNCE_MS = 2000;
/** Ceiling on how long continuous typing can defer a save. */
const AUTOSAVE_MAX_WAIT_MS = 20_000;
const AUTOSAVE_MAX_ATTEMPTS = 3;
const AUTOSAVE_RETRY_BASE_MS = 1000;

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  /** Performs one save. Must throw on failure so the hook can retry. */
  save: () => Promise<void>;
  /** False while there is nothing savable yet (e.g. an untouched /nova page). */
  enabled: boolean;
}

export interface UseAutosaveResult {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  /** Live mirror of `status` for reading right after an `await`. */
  statusRef: MutableRefObject<AutosaveStatus>;
  /** Marks the document dirty and (re)starts the debounce. */
  schedule: () => void;
  /** Saves immediately if dirty. Awaits the result. */
  flush: () => Promise<void>;
  /** Manual retry after the error state. */
  retry: () => Promise<void>;
}

/**
 * Debounced, single-flight autosave with retry and a visible status.
 *
 * Single-flight matters: without it a slow request and a fast one can land out
 * of order and resurrect stale text. Only one save is ever in flight; if the
 * document changes while it runs, exactly one more save is queued behind it.
 */
export function useAutosave({ save, enabled }: UseAutosaveOptions): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Live mirror of `status` for event handlers that need to read it after an
  // `await` (state closures would hold the value from render time).
  const statusRef = useRef<AutosaveStatus>('idle');
  const setStatusBoth = useCallback((next: AutosaveStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const saveRef = useRef(save);

  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const inFlightPromiseRef = useRef<Promise<void> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    debounceRef.current = null;
    maxWaitRef.current = null;
  }, []);

  const runSaveRef = useRef<() => Promise<void>>(async () => {});

  const runSave = useCallback((): Promise<void> => {
    // An in-flight save already covers the dirty content (the document is
    // snapshotted when the request starts); callers that need certainty, e.g.
    // flush() before publish, await the same promise instead of firing a
    // duplicate request.
    if (!dirtyRef.current || inFlightRef.current) return inFlightPromiseRef.current ?? Promise.resolve();

    clearTimers();
    inFlightRef.current = true;
    dirtyRef.current = false;
    setStatusBoth('saving');

    const task = (async () => {
      for (let attempt = 1; attempt <= AUTOSAVE_MAX_ATTEMPTS; attempt += 1) {
        try {
          await saveRef.current();
          setStatusBoth('saved');
          setLastSavedAt(new Date());
          inFlightRef.current = false;
          inFlightPromiseRef.current = null;
          // Changes that arrived mid-flight are still unsaved.
          if (dirtyRef.current) void runSaveRef.current();
          return;
        } catch {
          if (attempt === AUTOSAVE_MAX_ATTEMPTS) {
            dirtyRef.current = true;
            inFlightRef.current = false;
            inFlightPromiseRef.current = null;
            setStatusBoth('error');
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, AUTOSAVE_RETRY_BASE_MS * attempt));
        }
      }
    })();
    inFlightPromiseRef.current = task;
    return task;
  }, [clearTimers, setStatusBoth]);

  // Latest-value refs are synced after commit, never during render: a render-time
  // write is unsafe under concurrent rendering and both refs are only ever read
  // from timers, effects and event handlers, which run after the effect has flushed.
  useEffect(() => {
    saveRef.current = save;
    runSaveRef.current = runSave;
  });

  const schedule = useCallback(() => {
    if (!enabled) return;
    dirtyRef.current = true;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSave(), AUTOSAVE_DEBOUNCE_MS);

    // Independent ceiling so continuous typing still gets saved periodically.
    if (!maxWaitRef.current) {
      maxWaitRef.current = setTimeout(() => void runSave(), AUTOSAVE_MAX_WAIT_MS);
    }
  }, [enabled, runSave]);

  const flush = useCallback(async () => {
    clearTimers();
    await runSave();
    // A save that was already in flight when flush() ran may have queued a
    // follow-up for changes that arrived mid-flight — drain the whole chain.
    while (inFlightRef.current) {
      await inFlightPromiseRef.current;
    }
  }, [clearTimers, runSave]);

  const retry = useCallback(async () => {
    dirtyRef.current = true;
    await runSave();
  }, [runSave]);

  // Backgrounding the tab is the most common way work is lost.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void runSave();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [runSave]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !inFlightRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  return { status, lastSavedAt, statusRef, schedule, flush, retry };
}