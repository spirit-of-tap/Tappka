'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function BackButton({ fallbackHref = '/cteni/prehled' }: { fallbackHref?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const goBack = () => {
    if (pending) return;
    // router.back() on an empty history is a silent no-op — land somewhere
    // sensible instead of leaving the button spinning forever.
    if (window.history.length <= 1) {
      router.replace(fallbackHref);
      return;
    }
    setPending(true);
    router.back();
  };

  return (
    <Button variant="ghost" className="gap-2 -ml-3" onClick={goBack} disabled={pending}>
      {pending ? <Spinner className="size-4" /> : <ArrowLeft className="size-4" />}
      Zpět
    </Button>
  );
}
