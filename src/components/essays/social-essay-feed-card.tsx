'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, MessageCircle, Sparkles, Trophy, Flame } from 'lucide-react';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfileAvatar } from '@/components/profile-avatar';
import { EssayVoteButton } from './essay-vote-button';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { ContentSourceIllustration } from '@/components/content-sources/content-source-illustration';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPoints } from '@/lib/books/points';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import { countWords, formatReadingTime } from '@/lib/essays/text-stats';
import { formatRelativeTime, isRecentEssay } from '@/lib/essays/date-helpers';
import { cn } from '@/lib/utils';
import type { EssayWithDetails } from '@/lib/essays/types';

export interface AuthorGamificationStats {
  bookPoints: number;
  essayCount: number;
  isTeamTopReader?: boolean;
}

export interface SocialEssayFeedCardProps {
  essay: EssayWithDetails;
  initialVoted?: boolean;
  teamName?: string | null;
  authorStats?: AuthorGamificationStats | null;
  spotlightLabel?: string | null;
  className?: string;
}

export function getEssayGamificationBadge(
  essay: EssayWithDetails,
  authorStats?: AuthorGamificationStats | null,
): { label: string; icon: React.ElementType; className: string } | null {
  if (authorStats?.isTeamTopReader && authorStats.bookPoints > 0) {
    return {
      label: `Největší čtenář:ka týmu · ${authorStats.bookPoints} b.`,
      icon: Trophy,
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }

  if (essay.vote_count >= 5 || essay.comment_count >= 3) {
    return {
      label: 'Živá diskuze',
      icon: Flame,
      className: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    };
  }

  if (isRecentEssay(essay.created_at) && essay.vote_count === 0) {
    return {
      label: 'Čerstvě dopsáno',
      icon: Sparkles,
      className: 'border-primary/30 bg-primary/10 text-primary',
    };
  }

  if (authorStats && authorStats.bookPoints >= 10) {
    return {
      label: `${authorStats.bookPoints} b. v četbě`,
      icon: Trophy,
      className: 'border-primary/20 bg-primary/5 text-primary',
    };
  }

  return null;
}

export function extractEssaySnippet(essay: { content_text?: string | null }, maxLength = 520): string | null {
  const rawSnippet = (essay.content_text ?? '').trim();
  if (!rawSnippet) return null;
  return rawSnippet.length > maxLength ? `${rawSnippet.slice(0, maxLength).trimEnd()}…` : rawSnippet;
}

export function SocialEssayFeedCard({
  essay,
  initialVoted = false,
  teamName,
  authorStats,
  spotlightLabel,
  className,
}: SocialEssayFeedCardProps) {
  const words = countWords(essay.content_text ?? '');
  const readingTime = formatReadingTime(words);
  const relativeTime = formatRelativeTime(essay.created_at);
  const badge = getEssayGamificationBadge(essay, authorStats);
  const snippet = extractEssaySnippet(essay);
  const source = getEssaySourceDisplay(essay);

  const isSpotlight = Boolean(spotlightLabel);

  return (
    <article
      className={cn(
        'group flex flex-col rounded-2xl border bg-card p-4.5 sm:p-5 transition-all hover:border-border hover:shadow-sm space-y-3.5',
        isSpotlight && 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-card dark:from-amber-950/20 shadow-xs',
        className,
      )}
    >
      {/* Optional Spotlight Eyebrow */}
      {spotlightLabel && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 pb-1 border-b border-amber-500/20">
          <Flame className="size-3.5 text-amber-500" />
          <span>{spotlightLabel}</span>
        </div>
      )}

      {/* 1. Author row & Gamification Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 sm:size-9 shrink-0 overflow-hidden rounded-full bg-muted">
            {essay.author?.picture ? (
              <ProfileAvatar
                picture={essay.author.picture}
                name={essay.author.name}
                size={36}
                className="size-full"
              />
            ) : (
              <span className="flex size-full items-center justify-center text-xs font-semibold">
                {essay.author?.name?.[0] ?? '?'}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground truncate">
                {essay.author?.name}
              </span>
              {teamName && (
                <span className="text-xs text-muted-foreground">· {teamName}</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">{relativeTime}</p>
          </div>
        </div>

        {badge && (
          <Badge variant="outline" className={cn('gap-1 px-2.5 py-0.5 text-xs font-medium shrink-0', badge.className)}>
            <badge.icon className="size-3.5" />
            {badge.label}
          </Badge>
        )}
      </div>

      {/* 2. Source Connection Capsule (book or content source) */}
      {essay.book ? (
        <Link
          href={`/cteni/knihy/${essay.book.id}`}
          className="flex items-center gap-2.5 rounded-xl border bg-muted/40 p-2 transition-colors hover:bg-muted/70"
        >
          <div className="flex h-10 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
            {essay.book.google_books_cover_url ? (
              <StorageImage
                storageKey={essay.book.google_books_cover_url}
                alt={essay.book.title_cs}
                width={28}
                height={40}
                className="size-full object-cover"
              />
            ) : (
              <BookOpen className="size-3.5 text-muted-foreground/50" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="truncate text-xs font-medium text-foreground">
                {essay.book.title_cs}
              </span>
              <BookStatusBadges book={essay.book} />
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{essay.book.author}</p>
          </div>

          {!source.isArchived && source.points > 0 && (
            <Badge
              variant="secondary"
              className="shrink-0 text-xs font-semibold"
              title={source.isFrozen ? 'Body za tuto esej jsou zamčené ze staršího systému.' : undefined}
            >
              {formatPoints(source.points)} b.
            </Badge>
          )}
        </Link>
      ) : essay.content_source ? (
        /* Content sources have no detail page to link to — same capsule, no link. */
        <div className="flex items-center gap-2.5 rounded-xl border bg-muted/40 p-2">
          <ContentSourceIllustration kind={essay.content_source.kind} className="h-10 w-7 shrink-0" />

          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">
              {source.title}
            </span>
            <p className="truncate text-[11px] text-muted-foreground">
              {CONTENT_SOURCE_KIND_LABELS[essay.content_source.kind]}
              {source.author ? ` · ${source.author}` : ''}
            </p>
          </div>

          {!source.isArchived && source.points > 0 && (
            <Badge variant="secondary" className="shrink-0 text-xs font-semibold">
              {formatPoints(source.points)} b.
            </Badge>
          )}
        </div>
      ) : null}

      {/* 3. Essay Title & Excerpt */}
      <div className="space-y-2">
        <Link href={`/cteni/eseje/${essay.id}`} className="block">
          <h3 className="text-base sm:text-lg font-bold text-foreground transition-colors group-hover:text-primary leading-snug">
            {essay.title}
          </h3>
        </Link>

        {snippet ? (
          <Link href={`/cteni/eseje/${essay.id}`} className="block">
            <p className="text-sm sm:text-[15px] leading-relaxed text-muted-foreground hover:text-foreground transition-colors">
              „{snippet}“
            </p>
          </Link>
        ) : null}
      </div>

      {/* 4. Action bar */}
      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <div className="flex items-center gap-3">
          <EssayVoteButton
            essayId={essay.id}
            initialVoteCount={essay.vote_count}
            initialVoted={initialVoted}
            size="sm"
          />

          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Link href={`/cteni/eseje/${essay.id}#komentare`}>
              <MessageCircle className="size-3.5" />
              <span>{essay.comment_count > 0 ? essay.comment_count : 'Komentovat'}</span>
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {readingTime}
          </span>

          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold text-primary hover:text-primary">
            <Link href={`/cteni/eseje/${essay.id}`}>
              Přečíst
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
