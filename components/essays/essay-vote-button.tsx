'use client';

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EssayVoteButtonProps {
  essayId: string;
  initialVoteCount: number;
  initialVoted: boolean;
  readOnly?: boolean;
}

export function EssayVoteButton({
  essayId,
  initialVoteCount,
  initialVoted,
  readOnly = false,
}: EssayVoteButtonProps) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialVoteCount);
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading || readOnly) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/vote`, {
        method: voted ? 'DELETE' : 'POST',
      });
      if (res.ok || res.status === 409) {
        if (res.ok) {
          setVoted((v) => !v);
          setCount((c) => (voted ? c - 1 : c + 1));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (readOnly) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
        <ChevronUp className="size-3" />
        {count}
      </span>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={voted ? 'Odebrat hlas' : 'Hlasovat'}
      className={cn(
        'flex items-center gap-1 text-xs rounded-full px-2 py-0.5 transition-colors select-none',
        voted
          ? 'bg-primary/15 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <ChevronUp className="size-3" />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
