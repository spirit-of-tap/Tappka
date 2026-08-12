'use client';

import Link from 'next/link';
import { Eye, BookOpen, MessageCircle, Sparkles, Pin, PenLine, ArrowRight } from 'lucide-react';
import { StorageImage } from '@/components/storage/storage-image';
import { EssayVoteButton } from './essay-vote-button';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { formatPoints, pointsNumber } from '@/lib/books/points';
import { countWords, formatWordCount } from '@/lib/essays/text-stats';
import { isEssayPinned, type EssayWithDetails } from '@/lib/essays/types';

/** Preview length for a koncept row, matched to the published rows above. */
const DRAFT_SNIPPET_LENGTH = 120;

interface MyEssayListProps {
  essays: EssayWithDetails[];
  drafts?: EssayWithDetails[];
  votedEssayIds?: Set<string>;
}

export function MyEssayList({ essays, drafts = [], votedEssayIds = new Set() }: MyEssayListProps) {
  const bookEssays = essays.filter((e) => e.book);
  const topicEssays = essays.filter((e) => !e.book);

  const sortPinned = (a: EssayWithDetails, b: EssayWithDetails) => {
    const aPinned = isEssayPinned(a);
    const bPinned = isEssayPinned(b);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  };

  const sorted = [...bookEssays.sort(sortPinned), ...topicEssays.sort(sortPinned)];

  return (
    <div className="space-y-6">
      {drafts.length > 0 && (
        // Dashed edges mark "unfinished" here and on the koncept badge in the
        // editor, so a draft never reads as a published essay at a glance.
        <section className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] px-3 py-2.5">
          <h3 className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
            <span className="flex items-center gap-1.5">
              <PenLine className="size-3.5 text-primary" />
              Koncepty ({drafts.length})
            </span>
            <span className="text-xs font-normal text-muted-foreground">Vidíš je jenom ty</span>
          </h3>

          <ul className="divide-y divide-primary/10">
            {drafts.map((draft) => {
              const text = draft.content_text ?? '';
              const words = countWords(text);
              const snippet = text.slice(0, DRAFT_SNIPPET_LENGTH).trimEnd();
              return (
                <li key={draft.id}>
                  <Link
                    href={`/cteni/eseje/${draft.id}/upravit`}
                    className="group focus-ring -mx-1.5 block rounded-lg px-1.5 py-2 transition-colors hover:bg-primary/5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium">
                        {draft.title.trim() ? draft.title : 'Bez názvu'}
                      </p>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                        Pokračovat
                        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                    {snippet && (
                      <p className="truncate text-xs text-muted-foreground/70">
                        {snippet}{text.length > DRAFT_SNIPPET_LENGTH ? '…' : ''}
                      </p>
                    )}
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatWordCount(words)}</span>
                      <span aria-hidden className="text-muted-foreground/40">·</span>
                      <span>
                        upraveno {new Date(draft.updated_at).toLocaleDateString('cs-CZ', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="space-y-2">
      {drafts.length > 0 && sorted.length > 0 && (
        <h3 className="text-sm font-semibold">Zveřejněné ({sorted.length})</h3>
      )}

      <div className="divide-y divide-border/50">
      {sorted.map((essay, i) => {
        const snippet = (essay.content_text ?? '').slice(0, 120).trimEnd();
        const date = new Date(essay.created_at).toLocaleDateString('cs-CZ', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
        const points = pointsNumber(essay.book?.book_points);
        const hasPoints = essay.book?.list_status !== 'archived' && points > 0;
        const isRejected = essay.book?.list_status === 'archived';
        const isTopic = !essay.book;

        return (
          <Link
            key={essay.id}
            href={`/cteni/eseje/${essay.id}`}
            className="group focus-ring flex items-start gap-4 py-4 hover:bg-muted/30 transition-colors rounded-lg px-2 -mx-2"
          >
            {/* Index — only for book essays */}
            {!isTopic && (
              <span className="hidden sm:block w-6 shrink-0 text-right text-xs text-muted-foreground/40 font-mono pt-1 select-none">
                {String(i + 1).padStart(2, '0')}
              </span>
            )}
            {isTopic && (
              <span className="hidden sm:block w-6 shrink-0 pt-1 select-none" />
            )}

            {/* Cover */}
            <div className="shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center border border-border/40">
              {essay.book?.google_books_cover_url ? (
                <StorageImage
                  storageKey={essay.book.google_books_cover_url}
                  alt={essay.book.title_cs}
                  width={40}
                  height={56}
                  className="w-full h-full object-cover"
                />
              ) : isTopic ? (
                <Sparkles className="size-4 text-amber-500/40" />
              ) : (
                <BookOpen className="size-4 text-muted-foreground/30" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {isEssayPinned(essay) && (
                    <Pin className="size-3 shrink-0 text-primary fill-primary" />
                  )}
                  <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {essay.title}
                  </h3>
                </div>
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

              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {essay.book ? (
                  <>
                    {essay.book.title_cs}
                    <BookStatusBadges book={essay.book} />
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Sparkles className="size-3" />
                    Nad rámec četby
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
      </div>
    </div>
  );
}