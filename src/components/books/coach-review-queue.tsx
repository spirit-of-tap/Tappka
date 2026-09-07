'use client';

import { useState } from 'react';
import { BookOpen, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ReviewWorkbench } from './review-workbench';
import { ContentSourceReviewList } from '@/components/content-sources/content-source-review-list';
import { cn } from '@/lib/utils';
import type { ReviewPoints } from '@/lib/books/points';
import type { BookWithProfiles } from '@/lib/books/types';
import type { ContentSourceWithProfiles } from '@/lib/content-sources/types';

interface CoachReviewQueueProps {
  books: BookWithProfiles[];
  sources: ContentSourceWithProfiles[];
  initialSub?: 'books' | 'sources';
  onDecideBook: (book: BookWithProfiles, points: ReviewPoints, reason: string) => Promise<boolean>;
  onEditedBook: (book: BookWithProfiles) => void;
  onDeletedBook: (bookId: string) => void;
  onDecideSource: (source: ContentSourceWithProfiles, status: 'approved' | 'archived', points: number | null) => void;
}

export function CoachReviewQueue({
  books,
  sources,
  initialSub,
  onDecideBook,
  onEditedBook,
  onDeletedBook,
  onDecideSource,
}: CoachReviewQueueProps) {
  const [subQueue, setSubQueue] = useState<'books' | 'sources'>(() => {
    if (initialSub) return initialSub;
    if (books.length === 0 && sources.length > 0) return 'sources';
    return 'books';
  });

  return (
    <div className="space-y-4">
      {/* Sub-queue switcher: Knihy vs Ostatní zdroje */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="inline-flex items-center rounded-lg border bg-muted p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setSubQueue('books')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all',
              subQueue === 'books'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <BookOpen className="size-3.5" />
            <span>Knihy ke schválení</span>
            <Badge
              variant={books.length > 0 ? 'default' : 'secondary'}
              className="h-5 px-1.5 text-[11px]"
            >
              {books.length}
            </Badge>
          </button>
          <button
            type="button"
            onClick={() => setSubQueue('sources')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all',
              subQueue === 'sources'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Radio className="size-3.5" />
            <span>Ostatní zdroje ke schválení</span>
            <Badge
              variant={sources.length > 0 ? 'default' : 'secondary'}
              className="h-5 px-1.5 text-[11px]"
            >
              {sources.length}
            </Badge>
          </button>
        </div>
      </div>

      {subQueue === 'books' ? (
        <ReviewWorkbench
          books={books}
          onDecide={onDecideBook}
          onEdited={onEditedBook}
          onDeleted={onDeletedBook}
        />
      ) : (
        <ContentSourceReviewList
          key={sources.map((s) => s.id).join(',')}
          initialPending={sources}
          onDecideSuccess={onDecideSource}
        />
      )}
    </div>
  );
}
