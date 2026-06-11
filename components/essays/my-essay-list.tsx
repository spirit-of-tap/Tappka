'use client';

import Link from 'next/link';
import { Eye, BookOpen, FileQuestion, MessageCircle } from 'lucide-react';
import { StorageImage } from '@/components/storage/storage-image';
import { EssayVoteButton } from './essay-vote-button';
import { formatPoints, pointsNumber } from '@/lib/books/points';
import type { EssayWithDetails } from '@/lib/essays/types';

interface MyEssayListProps {
  essays: EssayWithDetails[];
  votedEssayIds?: Set<string>;
}

export function MyEssayList({ essays, votedEssayIds = new Set() }: MyEssayListProps) {
  return (
    <div className="divide-y divide-border/50">
      {essays.map((essay, i) => {
        const snippet = (essay.content_text ?? '').slice(0, 120).trimEnd();
        const date = new Date(essay.created_at).toLocaleDateString('cs-CZ', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const points = pointsNumber(essay.book?.book_points);
        const hasPoints = essay.book?.status === 'approved' && points > 0;
        const isRejected = essay.book?.status === 'rejected';

        return (
          <Link
            key={essay.id}
            href={`/eseje/${essay.id}`}
            className="group flex items-start gap-4 py-4 hover:bg-muted/30 transition-colors rounded-lg px-2 -mx-2"
          >
            {/* Index */}
            <span className="hidden sm:block w-6 shrink-0 text-right text-xs text-muted-foreground/40 font-mono pt-1 select-none">
              {String(i + 1).padStart(2, '0')}
            </span>

            {/* Book cover */}
            <div className="shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center border border-border/40">
              {essay.book?.cover_path ? (
                <StorageImage
                  storageKey={essay.book.cover_path}
                  alt={essay.book.title}
                  width={40}
                  height={56}
                  className="w-full h-full object-cover"
                />
              ) : (
                <BookOpen className="size-4 text-muted-foreground/30" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {essay.title}
                </h3>
                {hasPoints && (
                  <span className="shrink-0 text-xs font-semibold tabular-nums bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {formatPoints(points)} b.
                  </span>
                )}
                {isRejected && (
                  <span className="shrink-0 text-xs font-semibold tabular-nums bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">
                    0 b.
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {essay.book ? (
                  <>{essay.book.title}</>
                ) : (
                  <span className="italic flex items-center gap-1">
                    <FileQuestion className="size-3" />
                    Bez knihy
                  </span>
                )}
              </p>

              {snippet && (
                <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">
                  {snippet}{snippet.length === 120 ? '…' : ''}
                </p>
              )}

              <div className="flex items-center gap-3 pt-0.5 text-xs text-muted-foreground/50">
                <EssayVoteButton
                  essayId={essay.id}
                  initialVoteCount={essay.vote_count}
                  initialVoted={votedEssayIds.has(essay.id)}
                  readOnly
                />
                <span className="flex items-center gap-1">
                  <Eye className="size-3" />
                  {essay.view_count}
                </span>
                {essay.comment_count > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <MessageCircle className="size-3" />
                    {essay.comment_count}
                  </span>
                )}
                <span className="ml-auto">{date}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
