'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface BackButtonProps {
  fallbackHref?: string;
  /** When passed, navigation is deferred to this (e.g. an unsaved-changes confirm) instead of running immediately. */
  requestNavigation?: (action: () => void) => void;
}

export function BackButton({ fallbackHref = '/cteni/prehled', requestNavigation }: BackButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const navigate = () => {
    // router.back() on an empty history is a silent no-op — land somewhere
    // sensible instead of leaving the button spinning forever.
    if (window.history.length <= 1) {
      router.replace(fallbackHref);
      return;
    }
    setPending(true);
    router.back();
  };

  const goBack = () => {
    if (pending) return;
    if (requestNavigation) requestNavigation(navigate);
    else navigate();
  };

  // Same visual language as ui/page-back.tsx, but history-aware for flows
  // with multiple possible entry points.
  return (
    <button
      type="button"
      onClick={goBack}
      disabled={pending}
      className="focus-ring -ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
    >
      {pending ? <Spinner className="size-5 shrink-0" /> : <ChevronLeft className="size-5 shrink-0" aria-hidden="true" />}
      Zpět
    </button>
  );
}
