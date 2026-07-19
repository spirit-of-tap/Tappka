'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function BackButton() {
  const router = useRouter();

  return (
    <Button variant="ghost" className="gap-2 -ml-3" onClick={() => router.back()}>
      <ArrowLeft className="size-4" />
      Zpět
    </Button>
  );
}
