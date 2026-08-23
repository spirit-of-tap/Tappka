'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, ExternalLink, Library } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfileAvatar } from '@/components/profile-avatar';
import { BookStatusBadges } from './book-status-badges';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { formatPoints, pointsNumber } from '@/lib/books/points';
import { cn } from '@/lib/utils';
import type { BookWithProfiles } from '@/lib/books/types';

export interface BookEssayItem {
  id: string;
  title: string;
  author?: {
    id: string;
    name: string | null;
    picture: string | null;
    team_id?: string | null;
  } | null;
}

export interface FeedBookCardProps {
  book: BookWithProfiles;
  essays?: BookEssayItem[];
  inLibrary?: boolean;
  className?: string;
}

export function FeedBookCard({
  book,
  essays = [],
  inLibrary = false,
  className,
}: FeedBookCardProps) {
  const points = pointsNumber(book.book_points);
  const primaryTag = book.tags[0] ? (BOOK_CATEGORY_LABELS[book.tags[0]] ?? book.tags[0]) : null;

  return (
    <article
      className={cn(
        'group flex flex-col rounded-2xl border bg-card p-4 sm:p-5 transition-all hover:border-border hover:shadow-sm space-y-3.5',
        className,
      )}
    >
      {/* 1. Header: Compact Book Row (Cover + Title + Author + Points + Detail Link) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href={`/cteni/knihy/${book.id}`}
            className="shrink-0 w-11 h-15 sm:w-12 sm:h-17 rounded-md overflow-hidden bg-muted flex items-center justify-center shadow-2xs group-hover:shadow-xs transition-shadow"
          >
            {book.google_books_cover_url ? (
              <StorageImage
                storageKey={book.google_books_cover_url}
                alt={book.title_cs}
                width={48}
                height={68}
                className="size-full object-cover"
              />
            ) : (
              <BookOpen className="size-4 text-muted-foreground/40" />
            )}
          </Link>

          <div className="min-w-0 space-y-0.5">
            <Link href={`/cteni/knihy/${book.id}`} className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-1">
                {book.title_cs}
              </h3>
              <BookStatusBadges book={book} />
            </Link>
            <p className="text-xs text-muted-foreground truncate">{book.author}</p>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5 flex-wrap">
              {primaryTag && (
                <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0 h-4.5">
                  {primaryTag}
                </Badge>
              )}
              {inLibrary && (
                <span className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 font-medium">
                  <Library className="size-2.5" />
                  V TAP Knihovně
                </span>
              )}
              {book.page_count && book.page_count > 0 && (
                <span>· {book.page_count} str.</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {points > 0 && book.list_status !== 'archived' && (
            <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5">
              {formatPoints(book.book_points)} b.
            </Badge>
          )}
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs font-semibold text-primary hover:text-primary px-2">
            <Link href={`/cteni/knihy/${book.id}`}>
              Detail
              <ArrowRight className="size-3 ml-0.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. THE HERO: Prominent Description (Why read it, review synopsis) */}
      {book.description ? (
        <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/90 font-normal">
          {book.description}
        </p>
      ) : null}

      {/* 3. List of Essays Written on this Book: [Avatar] Name: "Essay Title" -> */}
      {essays.length > 0 ? (
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Eseje k této knize ({book.essay_count})
            </p>
            {book.preview_link && (
              <a
                href={book.preview_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-2.5" />
                Google Knihy
              </a>
            )}
          </div>

          <div className="space-y-1">
            {essays.slice(0, 4).map((essay) => (
              <Link
                key={essay.id}
                href={`/cteni/eseje/${essay.id}`}
                className="group/item flex items-center justify-between gap-2.5 rounded-lg p-1.5 -mx-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="size-5.5 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center text-[9px] font-bold">
                    {essay.author?.picture ? (
                      <ProfileAvatar
                        picture={essay.author.picture}
                        name={essay.author.name ?? ''}
                        size={22}
                        className="size-full"
                      />
                    ) : (
                      essay.author?.name?.[0] ?? '?'
                    )}
                  </div>
                  <span className="font-semibold text-foreground shrink-0 text-xs">
                    {essay.author?.name ?? 'Student:ka'}
                  </span>
                  <span className="text-muted-foreground/40 shrink-0">:</span>
                  <span className="truncate text-foreground/80 group-hover/item:text-primary transition-colors text-xs italic">
                    „{essay.title}“
                  </span>
                </div>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/60 group-hover/item:translate-x-0.5 group-hover/item:text-foreground transition-all" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
          <span>Zatím bez eseje · Získej první {points > 0 ? `${formatPoints(book.book_points)} b.` : 'body'}</span>
          <Button asChild variant="ghost" size="sm" className="h-6 text-xs text-primary hover:text-primary px-1.5">
            <Link href={`/cteni/knihy/${book.id}`}>
              Napsat esej
              <ArrowRight className="size-3 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </article>
  );
}
