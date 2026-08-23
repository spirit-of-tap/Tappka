'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfileAvatar } from '@/components/profile-avatar';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { formatPoints, pointsNumber } from '@/lib/books/points';
import { formatCzechRelativeTime } from '@/lib/essays/date-helpers';
import { extractEssaySnippet } from '@/components/essays/social-essay-feed-card';
import type { BookWithProfiles } from '@/lib/books/types';
import type { EssayWithDetails } from '@/lib/essays/types';

export interface AlsoWroteCardProps {
  book: BookWithProfiles;
  essays: EssayWithDetails[];
  teamNamesById?: Record<string, string>;
}

export function AlsoWroteCard({
  book,
  essays,
  teamNamesById = {},
}: AlsoWroteCardProps) {
  const points = pointsNumber(book.book_points);

  return (
    <article className="group flex flex-col rounded-2xl border bg-card p-4 sm:p-5 transition-all hover:border-border hover:shadow-sm space-y-3.5">
      {/* Header Pill */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          <Users className="size-3.5" />
          <span>Taky napsali</span>
        </div>

        {points > 0 && book.list_status !== 'archived' && (
          <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5">
            {formatPoints(book.book_points)} b.
          </Badge>
        )}
      </div>

      {/* Book Capsule */}
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-2.5">
        <Link href={`/cteni/knihy/${book.id}`} className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="shrink-0 w-8 h-11 rounded overflow-hidden bg-muted flex items-center justify-center">
            {book.google_books_cover_url ? (
              <StorageImage
                storageKey={book.google_books_cover_url}
                alt={book.title_cs}
                width={32}
                height={44}
                className="size-full object-cover"
              />
            ) : (
              <BookOpen className="size-3 text-muted-foreground/40" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-foreground hover:text-primary transition-colors truncate">
                {book.title_cs}
              </span>
              <BookStatusBadges book={book} />
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{book.author}</p>
          </div>
        </Link>

        <Button asChild variant="ghost" size="sm" className="h-7 text-xs font-medium text-primary hover:text-primary px-2 shrink-0">
          <Link href={`/cteni/knihy/${book.id}`}>
            Kniha
            <ArrowRight className="size-3 ml-0.5" />
          </Link>
        </Button>
      </div>

      {/* Comparative Reflections (2–3 distinct perspectives) */}
      <div className="space-y-2">
        {essays.slice(0, 3).map((essay) => {
          const teamName = essay.author?.team_id ? teamNamesById[essay.author.team_id] : null;
          const timeAgo = essay.published_at ? formatCzechRelativeTime(essay.published_at) : null;
          const snippet = extractEssaySnippet(essay);

          return (
            <Link
              key={essay.id}
              href={`/cteni/eseje/${essay.id}`}
              className="block rounded-xl border bg-muted/10 hover:bg-muted/30 p-3 transition-colors space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-5 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center text-[9px] font-bold">
                    {essay.author?.picture ? (
                      <ProfileAvatar
                        picture={essay.author.picture}
                        name={essay.author.name ?? ''}
                        size={20}
                        className="size-full"
                      />
                    ) : (
                      essay.author?.name?.[0] ?? '?'
                    )}
                  </div>
                  <span className="font-semibold text-xs text-foreground truncate">
                    {essay.author?.name ?? 'Student:ka'}
                  </span>
                  {teamName && (
                    <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4">
                      {teamName}
                    </Badge>
                  )}
                </div>
                {timeAgo && (
                  <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo}</span>
                )}
              </div>

              <p className="font-medium text-xs text-foreground group-hover:text-primary transition-colors">
                „{essay.title}“
              </p>

              {snippet && (
                <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 italic">
                  {snippet}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </article>
  );
}
