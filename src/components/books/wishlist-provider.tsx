'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface WishlistContextValue {
  isSaved: (bookId: string) => boolean;
  setSaved: (bookId: string, saved: boolean) => void;
  savedCount: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

interface WishlistProviderProps {
  /** IDs on the viewer's shelf, fetched once in the /cteni layout. */
  initialSavedIds: string[];
  children: ReactNode;
}

/**
 * One client-side source of truth for the personal shelf.
 *
 * The /cteni layout fetches the saved IDs once; every card/detail can then
 * read the same state without prop-drilling a Set through each feed. Toggles
 * update this store optimistically and stay consistent across pages until the
 * next server render.
 */
export function WishlistProvider({ initialSavedIds, children }: WishlistProviderProps) {
  const [savedIds, setSavedIds] = useState(() => new Set(initialSavedIds));

  const setSaved = useCallback((bookId: string, saved: boolean) => {
    setSavedIds((previous) => {
      const next = new Set(previous);
      if (saved) next.add(bookId);
      else next.delete(bookId);
      return next;
    });
  }, []);

  const value = useMemo<WishlistContextValue>(
    () => ({
      isSaved: (bookId) => savedIds.has(bookId),
      setSaved,
      savedCount: savedIds.size,
    }),
    [savedIds, setSaved],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlistOptional(): WishlistContextValue | null {
  return useContext(WishlistContext);
}
