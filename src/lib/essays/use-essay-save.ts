import { useCallback, useEffect, useRef, useState } from 'react';

export type EssaySaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseEssaySaveOptions {
  /** Performs one save. Must throw on failure. */
  save: () => Promise<void>;
  /** False while there is nothing savable yet (e.g. an untouched /nova page). */
  enabled: boolean;
}

export interface UseEssaySaveResult {
  status: EssaySaveStatus;
  lastSavedAt: Date | null;
  isDirty: boolean;
  /** Marks the document dirty; does not save. Only the Save button/shortcut does. */
  markDirty: () => void;
  /** Saves now if dirty and not already saving. */
  save: () => Promise<void>;
}

/**
 * Manual, single-flight save with a visible status. No debounce, no retry
 * backoff — the author decides when to save (button or Cmd/Ctrl+S), and an
 * error simply leaves the change dirty so pressing Save again retries it.
 */
export function useEssaySave({ save, enabled }: UseEssaySaveOptions): UseEssaySaveResult {
  const [status, setStatus] = useState<EssaySaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const saveRef = useRef(save);
  const enabledRef = useRef(enabled);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    saveRef.current = save;
    enabledRef.current = enabled;
  });

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setIsDirty(true);
  }, []);

  const runSave = useCallback(async () => {
    if (!enabledRef.current || !dirtyRef.current || inFlightRef.current) return;

    inFlightRef.current = true;
    dirtyRef.current = false;
    setIsDirty(false);
    setStatus('saving');

    try {
      await saveRef.current();
      setStatus('saved');
      setLastSavedAt(new Date());
    } catch {
      dirtyRef.current = true;
      setIsDirty(true);
      setStatus('error');
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const runSaveRef = useRef(runSave);
  useEffect(() => {
    runSaveRef.current = runSave;
  });

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !inFlightRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      void runSaveRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { status, lastSavedAt, isDirty, markDirty, save: runSave };
}
