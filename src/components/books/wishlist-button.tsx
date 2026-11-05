'use client';

import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWishlistOptional } from '@/components/books/wishlist-provider';
import { cn } from '@/lib/utils';

export const WISHLIST_COPY = {
  addAria: 'Přidat do Chci si přečíst',
  removeAria: 'Odebrat z Chci si přečíst',
  labelUnsaved: 'Chci si přečíst',
  labelSaved: 'Uloženo ke čtení',
  toastAdded: 'Uloženo do „Chci si přečíst“',
  toastRemoved: 'Odebráno z „Chci si přečíst“',
  toastUndo: 'Zpět',
  toastError: 'Změnu se nepodařilo uložit. Zkus to znovu.',
} as const;

interface WishlistButtonProps {
  bookId: string;
  /** Icon-only inside dense rows/cards; labeled on the book detail. */
  variant?: 'icon' | 'labeled';
  className?: string;
}

export function WishlistButton({
  bookId,
  variant = 'icon',
  className,
}: WishlistButtonProps) {
  const wishlist = useWishlistOptional();
  const [localSaved, setLocalSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saved = wishlist?.isSaved(bookId) ?? localSaved;
  const setSaved = (next: boolean) => {
    if (wishlist) wishlist.setSaved(bookId, next);
    else setLocalSaved(next);
  };

  const persist = async (next: boolean) => {
    setSaved(next);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/books/${bookId}/wishlist`, {
        method: next ? 'POST' : 'DELETE',
      });
      if (!res.ok) throw new Error(`Chyba ${res.status}`);
      return true;
    } catch {
      setSaved(!next);
      toast.error(WISHLIST_COPY.toastError);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = async () => {
    if (isSaving) return;

    const next = !saved;
    const ok = await persist(next);
    if (!ok) return;

    if (next) {
      toast.success(WISHLIST_COPY.toastAdded);
    } else {
      // Removal is one click with no confirmation, so offer a quick way back.
      toast.success(WISHLIST_COPY.toastRemoved, {
        action: { label: WISHLIST_COPY.toastUndo, onClick: () => void persist(true) },
      });
    }
  };

  const ariaLabel = saved ? WISHLIST_COPY.removeAria : WISHLIST_COPY.addAria;
  const Icon = saved ? BookmarkCheck : Bookmark;

  if (variant === 'labeled') {
    return (
      <Button
        type="button"
        variant={saved ? 'secondary' : 'outline'}
        onClick={toggle}
        disabled={isSaving}
        aria-pressed={saved}
        aria-label={ariaLabel}
        className={cn('gap-2', className)}
      >
        <Icon className={cn('size-4', saved && 'text-primary')} aria-hidden="true" />
        {saved ? WISHLIST_COPY.labelSaved : WISHLIST_COPY.labelUnsaved}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          disabled={isSaving}
          aria-pressed={saved}
          aria-label={ariaLabel}
          className={cn(
            'shrink-0 text-muted-foreground hover:text-foreground',
            saved && 'text-primary hover:text-primary',
            className,
          )}
        >
          <Bookmark className={cn('size-4', saved && 'fill-current')} aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{ariaLabel}</TooltipContent>
    </Tooltip>
  );
}
