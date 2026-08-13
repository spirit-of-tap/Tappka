import type { ReactNode } from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from './book-status-badges';
import { cn } from '@/lib/utils';
import type { BookWithProfiles } from '@/lib/books/types';

const COVER_SIZES = {
  sm: { wrapper: 'w-9 h-12', width: 36, height: 48, icon: 'size-4' },
  md: { wrapper: 'w-10 h-14', width: 40, height: 56, icon: 'size-4' },
  lg: { wrapper: 'w-12 h-16', width: 48, height: 64, icon: 'size-5' },
} as const;

interface BookRowHeaderProps {
  book: Pick<BookWithProfiles, 'id' | 'title_cs' | 'author' | 'google_books_cover_url' | 'list_status' | 'is_rocket_model' | 'highlight_category'>;
  coverSize?: keyof typeof COVER_SIZES;
  showAuthor?: boolean;
  titleClassName?: string;
  /** className for the text column wrapper — pass `flex-1` when actions sit as a trailing sibling without `justify-between`. */
  textClassName?: string;
  /** Extra lines rendered below the author line, inside the same text column (e.g. status reason, highlight category). */
  children?: ReactNode;
}

/**
 * Cover thumbnail + title link + status badges (+ author line) — renders as
 * two adjacent fragment children (cover, text), meant to sit directly inside
 * a `flex` row alongside any trailing actions. Was copy-pasted near-verbatim
 * across coach-highlight-row, coach-dashboard's archived block, and
 * coach-list-table.
 */
export function BookRowHeader({
  book,
  coverSize = 'md',
  showAuthor = true,
  titleClassName,
  textClassName,
  children,
}: BookRowHeaderProps) {
  const size = COVER_SIZES[coverSize];

  return (
    <>
      <div className={cn('shrink-0 bg-muted rounded overflow-hidden flex items-center justify-center', size.wrapper)}>
        {book.google_books_cover_url ? (
          <StorageImage storageKey={book.google_books_cover_url} alt={book.title_cs} className="w-full h-full object-cover" width={size.width} height={size.height} />
        ) : (
          <BookOpen className={cn(size.icon, 'text-muted-foreground')} />
        )}
      </div>
      <div className={cn('min-w-0', textClassName)}>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/cteni/knihy/${book.id}`}
            className={cn('font-medium text-sm leading-snug hover:underline focus-ring', titleClassName)}
          >
            {book.title_cs}
          </Link>
          <BookStatusBadges book={book} />
        </div>
        {showAuthor && <p className="truncate text-xs text-muted-foreground">{book.author}</p>}
        {children}
      </div>
    </>
  );
}
