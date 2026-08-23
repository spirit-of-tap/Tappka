'use client';

import { useState } from 'react';
import { ChevronUp, ThumbsUp } from 'lucide-react';
import confetti from 'canvas-confetti';
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

  const toggle = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading || readOnly) return;

    // Capture button origin synchronously before async fetch (to avoid React event pooling nulling e.currentTarget)
    let origin = { x: 0.5, y: 0.7 };
    try {
      const rect = e.currentTarget.getBoundingClientRect();
      origin = {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      };
    } catch {
      // fallback
    }

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

            try {
              confetti({
                particleCount: 35,
                spread: 55,
                startVelocity: 24,
                scalar: 0.75,
                ticks: 160,
                origin,
                zIndex: 9999,
                colors: ['#b31b1b', '#e11d48', '#fb7185', '#f59e0b', '#fde68a'],
                disableForReducedMotion: true,
              });
            } catch {
              // ignore
            }
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
              'relative flex shrink-0 items-center gap-2.5 rounded-full border border-border/80 bg-card px-5 py-2.5 transition-colors select-none whitespace-nowrap shadow-2xs',
              burst && 'vote-pop',
              voted
                ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25 hover:bg-primary/90'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
