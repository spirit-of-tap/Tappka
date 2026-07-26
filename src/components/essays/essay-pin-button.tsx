'use client';

import { useState } from 'react';
import { Pin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EssayPinButtonProps {
  essayId: string;
  isPinned: boolean;
}

export function EssayPinButton({ essayId, isPinned: initialPinned }: EssayPinButtonProps) {
  const [pinned, setPinned] = useState(initialPinned);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/pin`, { method: 'POST' });
      if (!res.ok) return;
      const { data } = await res.json();
      setPinned(data.pinned_at != null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs rounded-md px-2 py-1 transition-colors',
        pinned
          ? 'bg-primary/10 text-primary hover:bg-primary/15'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      )}
      title={pinned ? 'Odepnout' : 'Připnout'}
    >
      <Pin className={cn('size-3', pinned && 'fill-primary')} />
      {pinned ? 'Připnuto' : 'Připnout'}
    </button>
  );
}