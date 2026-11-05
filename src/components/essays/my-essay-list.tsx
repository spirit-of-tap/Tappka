'use client';

import Link from 'next/link';
import { Eye, BookOpen, MessageCircle, Sparkles, Pin } from 'lucide-react';

import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { ContentSourceIllustration } from '@/components/content-sources/content-source-illustration';
import { EssayVoteButton } from './essay-vote-button';

import { formatPoints } from '@/lib/books/points';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import { LegacyPointsBadge } from '@/components/essays/legacy-points-badge';
import { isEssayPinned, type EssayWithDetails } from '@/lib/essays/types';
import { pluralizeCz } from '@/lib/utils/pluralize-cz';
import { cn } from '@/lib/utils';

interface MyEssayListProps {
  essays: EssayWithDetails[];
  votedEssayIds?: ReadonlySet<string>;
  /** Essays where a coach has the last word — floated to the top and highlighted. */
  awaitingReplyIds?: ReadonlySet<string>;
}

const NO_IDS: ReadonlySet<string> = new Set();

export function MyEssayList({
  essays,
  votedEssayIds = NO_IDS,
  awaitingReplyIds = NO_IDS,
}: MyEssayListProps) {
  // "Nad rámec četby" means no source at all — a content-source essay belongs
  // with the sourced ones, not with the beyond-the-list bucket.
  const bookEssays = essays.filter((e) => getEssaySourceDisplay(e).kind !== 'none');
  const topicEssays = essays.filter((e) => getEssaySourceDisplay(e).kind === 'none');

  const sortPinned = (a: EssayWithDetails, b: EssayWithDetails) => {
    const aPinned = isEssayPinned(a);
    const bPinned = isEssayPinned(b);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  };

  // Essays waiting on the author's reply come first, keeping the existing order otherwise.
  const sorted = [...bookEssays.sort(sortPinned), ...topicEssays.sort(sortPinned)].sort(
    (a, b) => Number(awaitingReplyIds.has(b.id)) - Number(awaitingReplyIds.has(a.id)),
  );

  return (
    <ul className="divide-y divide-border/60">
      {sorted.map((essay) => {
        const date = new Date(essay.created_at).toLocaleDateString('cs-CZ', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const source = getEssaySourceDisplay(essay);
        const points = source.points;
        const hasPoints = !source.isArchived && points > 0;
        const isRejected = source.isArchived;
        const isTopic = source.kind === 'none';
        const awaitingReply = awaitingReplyIds.has(essay.id);

        return (
          <li key={essay.id}>
            <Link
              href={awaitingReply ? `/cteni/eseje/${essay.id}#komentare` : `/cteni/eseje/${essay.id}`}
              className={cn(
                'group focus-ring -mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors',
                awaitingReply ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent/50',
              )}
            >
              <div className="flex h-12 w-8.5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted ring-1 ring-border/50">
                {essay.book?.google_books_cover_url ? (
                  <StorageImage
                    storageKey={essay.book.google_books_cover_url}
                    alt=""
                    width={34}
                    height={48}
                    className="size-full object-cover"
                  />
                ) : essay.content_source ? (
                  <ContentSourceIllustration kind={essay.content_source.kind} className="size-full" />
                ) : isTopic ? (
                  <Sparkles className="size-4 text-warning-strong/60" aria-hidden="true" />
                ) : (
                  <BookOpen className="size-4 text-muted-foreground/40" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isEssayPinned(essay) && (
                    <Pin className="size-3 shrink-0 fill-primary text-primary" aria-label="Připnuto" />
                  )}
                  <h3 className="truncate text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
                    {essay.title}
                  </h3>
                </div>

                {awaitingReply && (
                  <p className="flex items-center gap-1 text-xs font-medium text-primary">
                    <MessageCircle className="size-3 fill-current" aria-hidden="true" />
                    Kouč:ka čeká na tvou odpověď
                  </p>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex min-w-0 items-center gap-1.5 truncate">
                    {essay.book ? (
                      <>
                        <span className="truncate">{essay.book.title_cs}</span>
                        <BookStatusBadges book={essay.book} />
                      </>
                    ) : source.kind === 'content_source' || source.kind === 'legacy' ? (
                      <span className="truncate">{source.title}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-warning-strong">
                        <Sparkles className="size-3" aria-hidden="true" />
                        Nad rámec četby
                      </span>
                    )}
                  </span>
                  <span className="hidden shrink-0 items-center gap-3 sm:flex">
                    <EssayVoteButton
                      essayId={essay.id}
                      initialVoteCount={essay.vote_count}
                      initialVoted={votedEssayIds.has(essay.id)}
                      readOnly
                    />
                    <span className="flex items-center gap-1" aria-label={`${essay.view_count} zobrazení`}>
                      <Eye className="size-3" aria-hidden="true" />
                      {essay.view_count}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'flex shrink-0 items-center gap-1',
                      essay.comment_count > 0 && 'text-foreground',
                    )}
                    aria-label={`${essay.comment_count} ${pluralizeCz(essay.comment_count, ['komentář', 'komentáře', 'komentářů'])}`}
                  >
                    <MessageCircle className="size-3" aria-hidden="true" />
                    {essay.comment_count}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {hasPoints &&
                  (source.isFrozen ? (
                    <LegacyPointsBadge points={points} />
                  ) : (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
                      {formatPoints(points)} b.
                    </span>
                  ))}
                {isRejected && (
                  <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-destructive">
                    0 b.
                  </span>
                )}
                <span className="text-[11px] tabular-nums text-muted-foreground">{date}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
