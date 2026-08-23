'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UsePersistedStateOptions {
  storage?: 'localStorage' | 'sessionStorage';
}

/**
 * Persists a React state value to client storage (localStorage by default) across
 * subpage navigation, history back/forward, and component remounts.
 *
 * SSR-safe: Uses `defaultValue` during SSR and initial hydration render,
 * then synchronizes with client storage after mounting.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  options?: UsePersistedStateOptions,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const storageType = options?.storage ?? 'localStorage';
  const [state, setState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);
  const keyRef = useRef(key);
  keyRef.current = key;

  // Hydrate from storage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const storage = storageType === 'sessionStorage' ? window.sessionStorage : window.localStorage;
      const raw = storage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        setState(parsed);
      }
    } catch {
      // Storage unavailable, quota error, or JSON parse failure — fallback to defaultValue
    } finally {
      setIsHydrated(true);
    }
  }, [key, storageType]);

  const setPersistedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const nextValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        try {
          if (typeof window !== 'undefined') {
            const storage = storageType === 'sessionStorage' ? window.sessionStorage : window.localStorage;
            storage.setItem(keyRef.current, JSON.stringify(nextValue));
          }
        } catch {
          // Storage quota exceeded or disabled
        }
        return nextValue;
      });
    },
    [storageType],
  );

  return [state, setPersistedState, isHydrated];
}
