import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface UseUnsavedChangesGuardResult {
  isDialogOpen: boolean;
  /** Runs `action` now if nothing is blocking, otherwise defers it behind the confirm dialog. */
  requestNavigation: (action: () => void) => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

/**
 * Warns before the author loses unsaved work: blocks `beforeunload`
 * (tab close/refresh) and intercepts clicks on in-app links (sidebar, bottom
 * nav, …) so both routes go through the same confirm dialog. Browser
 * back/forward (`popstate`) is intentionally not covered — a reliable guard
 * there needs a history-stack trick that's disproportionate here.
 */
export function useUnsavedChangesGuard(isBlocking: boolean): UseUnsavedChangesGuardResult {
  const router = useRouter();
  const isBlockingRef = useRef(isBlocking);
  useEffect(() => {
    isBlockingRef.current = isBlocking;
  });

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requestNavigation = useCallback((action: () => void) => {
    if (isBlockingRef.current) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }, []);

  const confirmLeave = useCallback(() => {
    setPendingAction((current) => {
      current?.();
      return null;
    });
  }, []);

  const cancelLeave = useCallback(() => setPendingAction(null), []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isBlockingRef.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isBlockingRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest?.('a');
      const href = anchor?.getAttribute('href');
      if (!anchor || !href || !href.startsWith('/') || anchor.target === '_blank') return;

      event.preventDefault();
      requestNavigation(() => router.push(href));
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [requestNavigation, router]);

  return { isDialogOpen: pendingAction !== null, requestNavigation, confirmLeave, cancelLeave };
}
