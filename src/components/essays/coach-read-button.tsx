'use client';

import { useState, useTransition } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CoachReadButtonProps {
  essayId: string;
  initialRead: boolean;
  /** Notifies the parent after a successful toggle (e.g. to move list rows). */
  onToggled?: (read: boolean) => void;
  size?: 'sm' | 'default';
  className?: string;
}

export function CoachReadButton({
  essayId,
  initialRead,
  onToggled,
  size = 'default',
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
          return;
        }
        onToggled?.(next);
      } catch {
        setRead(!next); // revert
      }
    });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={read ? 'secondary' : 'default'}
      onClick={toggle}
      disabled={isPending}
      className={cn('gap-2', className)}
    >
      {read ? <CheckCheck className="size-4" /> : <Check className="size-4" />}
      {read ? 'Přečteno' : 'Označit jako přečtené'}
    </Button>
  );
}
