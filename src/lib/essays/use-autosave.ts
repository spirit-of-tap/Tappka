import { useCallback, useEffect, useRef, useState } from 'react';

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

  const saveRef = useRef(save);

  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    debounceRef.current = null;
    maxWaitRef.current = null;
  }, []);

  const runSaveRef = useRef<() => Promise<void>>(async () => {});

  const runSave = useCallback(async () => {
    if (!dirtyRef.current || inFlightRef.current) return;

    clearTimers();
    inFlightRef.current = true;
    dirtyRef.current = false;
    setStatus('saving');

    for (let attempt = 1; attempt <= AUTOSAVE_MAX_ATTEMPTS; attempt += 1) {
      try {
        await saveRef.current();
        setStatus('saved');
        setLastSavedAt(new Date());
        inFlightRef.current = false;
        // Changes that arrived mid-flight are still unsaved.
        if (dirtyRef.current) void runSaveRef.current();
        return;
      } catch {
        if (attempt === AUTOSAVE_MAX_ATTEMPTS) {
          dirtyRef.current = true;
          inFlightRef.current = false;
          setStatus('error');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, AUTOSAVE_RETRY_BASE_MS * attempt));
      }
    }
  }, [clearTimers]);

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

  return { status, lastSavedAt, schedule, flush, retry };
}