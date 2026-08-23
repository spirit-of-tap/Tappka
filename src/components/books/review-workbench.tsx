'use client';

import { useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ReviewDetailPanel } from './review-detail-panel';
import { ReviewQueueRail } from './review-queue-rail';
import { usePersistedState } from '@/lib/hooks/use-persisted-state';
import { cn } from '@/lib/utils';
import type { ReviewPoints } from '@/lib/books/points';
import type { BookWithProfiles } from '@/lib/books/types';

interface ReviewWorkbenchProps {
  books: BookWithProfiles[];
  /** 0 archives the book, 1–3 approve it into the longlist. */
  onDecide: (book: BookWithProfiles, points: ReviewPoints, reason: string) => Promise<boolean>;
  onEdited: (book: BookWithProfiles) => void;
  onDeleted: (bookId: string) => void;
}

/**
 * Master–detail review of the pending queue. Owns nothing but the selection —
 * the book lists and every mutation still live in `CoachDashboard`.
 */
export function ReviewWorkbench({ books, onDecide, onEdited, onDeleted }: ReviewWorkbenchProps) {
  // `null` means "no explicit pick": on wide viewports the panel falls through to
  // the head of the queue, on narrow ones the queue is what you see.
  const [selectedId, setSelectedId] = usePersistedState<string | null>('tappka:coach-review-workbench:selected-book', null, { storage: 'sessionStorage' });
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = books.find((book) => book.id === selectedId) ?? books[0] ?? null;

  /**
   * The decision bar sits at the foot of a tall panel, so a coach who just decided
   * is parked at the bottom of the page. Bring the incoming book's header back into
   * view — and on narrow screens, where selecting swaps the queue out for the panel,
   * do the same so the panel does not open mid-scroll.
   */
  const revealPanel = () => panelRef.current?.scrollIntoView({ block: 'start' });

  const handleSelect = (bookId: string) => {
    setSelectedId(bookId);
    if (!window.matchMedia('(min-width: 1024px)').matches) revealPanel();
  };

  /**
   * A decided book leaves the queue, so the selection has to move before the
   * list shrinks under it. Resolved from the current list, applied afterwards.
   */
  const neighbourOf = (bookId: string): string | null => {
    const index = books.findIndex((book) => book.id === bookId);
    if (index === -1) return null;
    return (books[index + 1] ?? books[index - 1])?.id ?? null;
  };

  const handleDecide = async (
    book: BookWithProfiles,
    points: ReviewPoints,
    reason: string,
  ): Promise<boolean> => {
    const next = neighbourOf(book.id);
    const ok = await onDecide(book, points, reason);
    if (ok) {
      setSelectedId(next);
      revealPanel();
    }
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
      {/*
        The panel is the only thing that sets the row height. Taking the rail out
        of flow (`absolute inset-0` over a `relative` grid cell) means its own
        length never contributes: however many books are queued, it renders exactly
        as tall as the panel beside it and scrolls inside itself past that. A
        `max-h` cap instead of this made the rail *shorter* than the panel — the
        mismatch you'd otherwise still see.
      */}
      <div className={cn('lg:relative', selectedId && 'hidden lg:block')}>
        <ReviewQueueRail
          books={books}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
          className="lg:absolute lg:inset-0"
        />
      </div>
      {selected && (
        <div ref={panelRef} className={cn('min-w-0 scroll-mt-4', !selectedId && 'hidden lg:block')}>
          <ReviewDetailPanel
            key={selected.id}
            book={selected}
            onDecide={handleDecide}
            onEdited={onEdited}
            onDeleted={handleDeleted}
            onBack={() => setSelectedId(null)}
          />
        </div>
      )}
    </div>
  );
}
