'use client';

import { BookOpen } from 'lucide-react';
import { StorageImage } from '@/components/storage/storage-image';
import { formatPoints } from '@/lib/books/points';
import { cn } from '@/lib/utils';
import type { BookWithProfiles } from '@/lib/books/types';

const THUMB_WIDTH = 32;
const THUMB_HEIGHT = 44;

interface ReviewQueueRailProps {
  books: BookWithProfiles[];
  selectedId: string | null;
  onSelect: (bookId: string) => void;
  className?: string;
}

function QueueThumb({ book }: { book: BookWithProfiles }) {
  return (
    <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
      {book.google_books_cover_url ? (
        <StorageImage
          storageKey={book.google_books_cover_url}
          alt={book.title_cs}
          className="h-full w-full object-cover"
          width={THUMB_WIDTH}
          height={THUMB_HEIGHT}
        />
      ) : (
        <BookOpen className="size-3.5 text-muted-foreground" />
      )}
    </div>
  );
}

/**
 * The pending queue. Ordered by `getProcessingBooks` — oldest first — so the
 * book that has waited longest sits at the top.
 */
export function ReviewQueueRail({ books, selectedId, onSelect, className }: ReviewQueueRailProps) {
  return (
    <nav
      aria-label="Fronta knih ke zpracování"
      className={cn('flex flex-col overflow-hidden rounded-lg border bg-card', className)}
    >
      <div className="flex shrink-0 items-baseline justify-between gap-2 border-b px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Fronta
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {books.length} · nejstarší první
        </span>
      </div>

      {/* Fills whatever height the grid row hands the rail and scrolls inside it.
          On a narrow screen the column has no imposed height, so this resolves to
          the list's own height and never becomes a scroll trap inside the page. */}
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {books.map((book) => {
          const isSelected = book.id === selectedId;
          return (
            <li key={book.id}>
              <button
                type="button"
                aria-current={isSelected ? 'true' : undefined}
                onClick={() => onSelect(book.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 border-l-2 px-3 py-2.5 text-left transition-colors focus-ring',
                  isSelected
                    ? 'border-l-primary bg-accent'
                    : 'border-l-transparent hover:bg-muted/60',
                )}
              >
                <QueueThumb book={book} />
                <span className="min-w-0 flex-1">
                  <span className="block line-clamp-2 text-sm font-medium leading-snug">
                    {book.title_cs}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{book.author}</span>
                </span>
                <span
                  className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
                  title={book.book_points === null ? 'AI knihu neohodnotila' : 'Návrh AI'}
                >
                  {book.book_points === null ? '—' : `${formatPoints(book.book_points)} b.`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
