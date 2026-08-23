'use client';

import { useState, useTransition } from 'react';
import { Check, CheckCheck, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface CoachReadButtonProps {
  essayId: string;
  initialRead: boolean;
  /** Notifies the parent after a successful toggle (e.g. to move list rows). */
  onToggled?: (read: boolean) => void;
  size?: 'sm' | 'default';
  variant?: 'button' | 'card';
  className?: string;
}

export function CoachReadButton({
  essayId,
  initialRead,
  onToggled,
  size = 'default',
  variant = 'button',
  className,
}: CoachReadButtonProps) {
  const [read, setRead] = useState(initialRead);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !read;
    setRead(next); // optimistic

    startTransition(async () => {
      try {
        const res = await fetch(`/api/essays/${essayId}/coach-read`, {
          method: next ? 'POST' : 'DELETE',
        });
        if (!res.ok) {
          setRead(!next); // revert
          toast.error('Nepodařilo se uložit stav přečtení.');
          return;
        }
        onToggled?.(next);
      } catch {
        setRead(!next); // revert
        toast.error('Nepodařilo se uložit stav přečtení.');
      }
    });
  };

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-xl border p-3.5 sm:p-4 transition-colors',
          read
            ? 'border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07]'
            : 'border-border bg-card/60',
          className,
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg',
              read
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-primary/10 text-primary',
            )}
          >
            {read ? <CheckCheck className="size-4" /> : <GraduationCap className="size-4" />}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">
              {read ? 'Přečteno koučem:koučkou' : 'Potvrdit přečtení'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {read
                ? 'Autor:ka vidí tvé potvrzení v hlavičce eseje.'
                : 'Autor:ka uvidí, že jsi esej přečetl:a.'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="default"
          variant={read ? 'secondary' : 'default'}
          onClick={toggle}
          disabled={isPending}
          className={cn(
            'shrink-0 gap-2 font-semibold shadow-xs',
            read && 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300',
          )}
        >
          {isPending ? (
            <Spinner className="size-4" />
          ) : read ? (
            <CheckCheck className="size-4" />
          ) : (
            <Check className="size-4" />
          )}
          {read ? 'Přečteno (zrušit)' : 'Označit jako přečtené'}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={read ? 'secondary' : 'default'}
      onClick={toggle}
      disabled={isPending}
      className={cn('gap-2', className)}
    >
      {isPending ? (
        <Spinner className="size-4" />
      ) : read ? (
        <CheckCheck className="size-4" />
      ) : (
        <Check className="size-4" />
      )}
      {read ? 'Přečteno' : 'Označit jako přečtené'}
    </Button>
  );
}
