'use client';

import Link from 'next/link';
import { Eye, BookOpen, MessageCircle, Sparkles, Pin } from 'lucide-react';

import { EssayVoteButton } from './essay-vote-button';

import { formatPoints } from '@/lib/books/points';
import { bookToneClass } from '@/lib/essays/book-tone';
import { getEssayStatus, type EssayStatusKind } from '@/lib/essays/essay-status';
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

const TOPIC_TONE_KEY = 'topic';

const STATUS_CHIP_CLASSES: Record<EssayStatusKind, string> = {
  draft: 'bg-muted text-foreground',
  pending: 'bg-warning/15 text-warning-strong',
  approved: 'bg-success/15 text-success-strong',
  rejected: 'bg-destructive/10 text-destructive-strong',
};

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
    <ul className="grid gap-3 sm:grid-cols-2">
      {sorted.map((essay) => {
        const date = new Date(essay.created_at).toLocaleDateString('cs-CZ', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const source = getEssaySourceDisplay(essay);
        const status = getEssayStatus(essay);
        const points = source.points;
        const hasPoints = !source.isArchived && points > 0;
        const isRejected = source.isArchived;
        const isTopic = source.kind === 'none';
        const awaitingReply = awaitingReplyIds.has(essay.id);
        const toneKey = essay.book?.id ?? essay.content_source?.id ?? TOPIC_TONE_KEY;

        return (
          <li key={essay.id}>
            <Link
              href={awaitingReply ? `/cteni/eseje/${essay.id}#komentare` : `/cteni/eseje/${essay.id}`}
              className={cn(
                'group focus-ring flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm motion-safe:transition-colors',
                awaitingReply ? 'bg-primary/5 hover:bg-primary/10' : 'bg-card hover:bg-accent/50',
              )}
            >
              <div className={cn('flex items-center gap-2 px-3 py-2 text-xs font-semibold', bookToneClass(toneKey))}>
                {isTopic ? (
                  <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{isTopic ? 'Nad rámec četby' : source.title}</span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex min-w-0 items-start gap-1.5">
                  {isEssayPinned(essay) && (
                    <Pin className="mt-1 size-3 shrink-0 fill-primary text-primary" aria-label="Připnuto" />
                  )}
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug motion-safe:transition-colors group-hover:text-primary">
                    {essay.title}
                  </h3>
                </div>

                {awaitingReply && (
                  <p className="flex items-center gap-1 text-xs font-medium text-primary">
                    <MessageCircle className="size-3 fill-current" aria-hidden="true" />
                    Kouč:ka čeká na tvou odpověď
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{date}</span>
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
                  <span
                    className={cn('flex items-center gap-1', essay.comment_count > 0 && 'text-foreground')}
                    aria-label={`${essay.comment_count} ${pluralizeCz(essay.comment_count, ['komentář', 'komentáře', 'komentářů'])}`}
                  >
                    <MessageCircle className="size-3" aria-hidden="true" />
                    {essay.comment_count}
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                  {status ? (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        STATUS_CHIP_CLASSES[status.kind],
                      )}
                    >
                      {status.label}
                    </span>
                  ) : (
                    <span />
                  )}
                  {hasPoints &&
                    (source.isFrozen ? (
                      <LegacyPointsBadge points={points} />
                    ) : (
                      <span className="text-sm font-semibold tabular-nums">{formatPoints(points)} b.</span>
                    ))}
                  {isRejected && (
                    <span className="text-sm font-semibold tabular-nums text-destructive-strong">0 b.</span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
