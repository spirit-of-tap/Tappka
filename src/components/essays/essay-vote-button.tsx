'use client';

import { useState } from 'react';
import { ChevronUp, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface EssayVoteButtonProps {
  essayId: string;
  initialVoteCount: number;
  initialVoted: boolean;
  readOnly?: boolean;
  size?: 'sm' | 'lg';
}

export function EssayVoteButton({
  essayId,
  initialVoteCount,
  initialVoted,
  readOnly = false,
  size = 'sm',
}: EssayVoteButtonProps) {
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialVoteCount);
  const [loading, setLoading] = useState(false);
  const [burst, setBurst] = useState(false);

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
          const nowVoted = !voted;
          setVoted(nowVoted);
          setCount((c) => (voted ? c - 1 : c + 1));
          if (nowVoted) {
            setBurst(true);
            setTimeout(() => setBurst(false), 600);
          }
        }
      } else {
        toast.error('Nepodařilo se hlasovat. Zkus to znovu.');
      }
    } catch {
      toast.error('Nepodařilo se hlasovat. Zkus to znovu.');
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

  if (size === 'lg') {
    return (
      <div className="flex items-center gap-4">
        <div className="relative">
          {/* Burst particles */}
          {burst && (
            <>
              {[
                { tx: 'translateX(-18px)', ty: 'translateY(-18px)' },
                { tx: 'translateX(0px)',   ty: 'translateY(-24px)' },
                { tx: 'translateX(18px)',  ty: 'translateY(-18px)' },
                { tx: 'translateX(22px)',  ty: 'translateY(0px)'   },
                { tx: 'translateX(18px)',  ty: 'translateY(18px)'  },
                { tx: 'translateX(-22px)', ty: 'translateY(0px)'   },
              ].map((p, i) => (
                <span
                  key={i}
                  className="particle absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary pointer-events-none"
                  style={{ '--tx': p.tx, '--ty': p.ty } as React.CSSProperties}
                />
              ))}
            </>
          )}

          {/* Floating +1 */}
          {burst && (
            <span className="count-float absolute -top-1 left-1/2 -translate-x-1/2 text-xs font-bold text-primary pointer-events-none select-none">
              +1
            </span>
          )}

          <button
            onClick={toggle}
            disabled={loading}
            aria-label={voted ? 'Odebrat hlas' : 'Označit esej jako užitečnou'}
            className={cn(
              'relative flex shrink-0 items-center gap-2.5 rounded-2xl px-6 py-3 transition-colors select-none whitespace-nowrap',
              burst && 'vote-pop',
              voted
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
          >
            {loading ? (
              <Spinner className="size-4" />
            ) : (
              <ThumbsUp className={cn('transition-transform', voted ? 'size-5' : 'size-4')} />
            )}
            <span className="text-sm font-semibold">
              {voted ? 'Líbilo se mi to' : 'Líbí se mi to'}
            </span>
            <span className="tabular-nums text-sm opacity-60">{count}</span>
          </button>
        </div>

        <span className="text-xs text-muted-foreground max-w-[16rem]">
          {voted
            ? 'Díky! Pomáháš ostatním najít nejlepší eseje.'
            : 'Klikni, pokud ti esej přinesla novou perspektivu nebo nápad.'}
        </span>
      </div>
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
      {loading ? <Spinner className="size-3" /> : <ChevronUp className="size-3" />}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
