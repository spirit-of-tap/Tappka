'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ReviewDetailPanel } from './review-detail-panel';
import { ReviewQueueRail } from './review-queue-rail';
import { cn } from '@/lib/utils';
import type { CoachPoints } from '@/lib/books/points';
import type { BookWithProfiles } from '@/lib/books/types';

interface ReviewWorkbenchProps {
  books: BookWithProfiles[];
  onApprove: (book: BookWithProfiles, bookPoints: CoachPoints, reason: string) => Promise<boolean>;
  onReject: (book: BookWithProfiles, reason: string) => Promise<boolean>;
  onEdited: (book: BookWithProfiles) => void;
  onDeleted: (bookId: string) => void;
}

/**
 * Master–detail review of the pending queue. Owns nothing but the selection —
 * the book lists and every mutation still live in `CoachDashboard`.
 */
export function ReviewWorkbench({
  books,
  onApprove,
  onReject,
  onEdited,
  onDeleted,
}: ReviewWorkbenchProps) {
  // `null` means "no explicit pick": on wide viewports the panel falls through to
  // the head of the queue, on narrow ones the queue is what you see.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = books.find((book) => book.id === selectedId) ?? books[0] ?? null;

  /**
   * A decided book leaves the queue, so the selection has to move before the
   * list shrinks under it. Resolved from the current list, applied afterwards.
   */
  const neighbourOf = (bookId: string): string | null => {
    const index = books.findIndex((book) => book.id === bookId);
    if (index === -1) return null;
    return (books[index + 1] ?? books[index - 1])?.id ?? null;
  };

  const advanceAfter = async (
    book: BookWithProfiles,
    decide: () => Promise<boolean>,
  ): Promise<boolean> => {
    const next = neighbourOf(book.id);
    const ok = await decide();
    if (ok) setSelectedId(next);
    return ok;
  };

  const handleDeleted = (bookId: string) => {
    setSelectedId(neighbourOf(bookId));
    onDeleted(bookId);
  };

  if (books.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>Fronta je prázdná</EmptyTitle>
          <EmptyDescription>Všechny navržené knihy jsou zpracované.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr] lg:gap-6">
      <ReviewQueueRail
        books={books}
        selectedId={selected?.id ?? null}
        onSelect={setSelectedId}
        // The app header scrolls away with the page, so the rail only needs
        // enough offset to clear the viewport edge.
        className={cn('lg:sticky lg:top-4 lg:self-start', selectedId && 'hidden lg:block')}
      />
      {selected && (
        <div className={cn('min-w-0', !selectedId && 'hidden lg:block')}>
          <ReviewDetailPanel
            key={selected.id}
            book={selected}
            onApprove={(book, points, reason) =>
              advanceAfter(book, () => onApprove(book, points, reason))
            }
            onReject={(book, reason) => advanceAfter(book, () => onReject(book, reason))}
            onEdited={onEdited}
            onDeleted={handleDeleted}
            onBack={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
