import type { ElementType, ReactNode } from 'react';
import { BadgeCheck, Medal, Rocket, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BOOK_STATUS_COLORS, BOOK_STATUS_LABELS } from '@/lib/books/types';
import type { BookListStatus, BookWithProfiles, HighlightCategory } from '@/lib/books/types';

function IconBadge({
  icon: Icon, label, tooltip, className,
}: { icon: ElementType; label: string; tooltip?: ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Icon aria-label={label} className={cn('size-3.5 shrink-0', className)} />
      </TooltipTrigger>
      <TooltipContent>{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}

/** Was copy-pasted identically across 4 coach files — now a single source. */
export function RocketBadge({ className }: { className?: string }) {
  return (
    <IconBadge
      icon={Rocket}
      label="Raketový model"
      tooltip="Raketový model — kniha zařazená do raketového modelu rozvoje."
      className={cn('text-primary', className)}
    />
  );
}

/**
 * Single presentation for `list_status` — replaces the outline-Badge /
 * plain-span / raw-enum-string mix previously scattered across coach views.
 */
export function ListStatusBadge({ status, className }: { status: BookListStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('border-none text-xs font-medium', BOOK_STATUS_COLORS[status], className)}>
      {BOOK_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Twitter-style verified check (shortlist) / rejected cross (archived) —
 * meant to sit right next to a book title. longlist/processing render
 * nothing here; they keep whatever points/status pill already exists.
 */
export function VerifiedBadge({ status, className }: { status: BookListStatus; className?: string }) {
  if (status === 'shortlist') {
    return (
      <IconBadge
        icon={BadgeCheck}
        label="Ověřená kniha"
        tooltip="Ověřená kniha — přináší velkou hodnotu a je dobrou volbou."
        className={cn('text-blue-500 dark:text-blue-400', className)}
      />
    );
  }
  if (status === 'archived') {
    return (
      <IconBadge
        icon={XCircle}
        label="Zamítnuto"
        tooltip="Zamítnutá kniha — kouči ji z výběru vyřadili."
        className={cn('text-destructive', className)}
      />
    );
  }
  return null;
}

interface HighlightBadgeProps {
  category: HighlightCategory;
  variant?: 'compact' | 'full';
  className?: string;
}

/** `compact` for cards/rows (icon + tooltip); `full` for the book detail hero (icon + category name). */
export function HighlightBadge({ category, variant = 'full', className }: HighlightBadgeProps) {
  const tooltip = `Vybraná kniha — součást kurátorského výběru „${category.name}“.`;

  if (variant === 'compact') {
    return <IconBadge icon={Medal} label={category.name} tooltip={tooltip} className={cn('text-amber-600 dark:text-amber-400', className)} />;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200', className)}>
          <Medal className="size-3" />
          {category.name}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

interface BookStatusBadgesProps {
  book: Pick<BookWithProfiles, 'list_status' | 'is_rocket_model' | 'highlight_category'>;
  /** Only affects the highlight sub-badge — verified/rejected stay icon-only either way. */
  variant?: 'compact' | 'full';
  className?: string;
}

/**
 * Student-facing composite badge row: bundles verified/rejected + rocket +
 * highlight for compact contexts (cards, list rows). For a book detail hero
 * where the verified/rejected check belongs right next to the <h1>, use
 * `VerifiedBadge` directly instead of this composite.
 */
export function BookStatusBadges({ book, variant = 'compact', className }: BookStatusBadgesProps) {
  const hasBadge = book.list_status === 'shortlist' || book.list_status === 'archived' || book.is_rocket_model || book.highlight_category;
  if (!hasBadge) return null;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <VerifiedBadge status={book.list_status} />
      {book.is_rocket_model && <RocketBadge />}
      {book.highlight_category && <HighlightBadge category={book.highlight_category} variant={variant} />}
    </span>
  );
}
