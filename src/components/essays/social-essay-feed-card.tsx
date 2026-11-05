'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, Check, Clock, Flame, MessageCircle, Sparkles, Trophy, Users } from 'lucide-react';
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
import { LegacyPointsBadge } from '@/components/essays/legacy-points-badge';
import { countWords, formatReadingTime } from '@/lib/essays/text-stats';
import { formatRelativeTime, isRecentEssay } from '@/lib/essays/date-helpers';
import { cn } from '@/lib/utils';
import { structureBookTitle } from '@/lib/books/format-title';
import type { EssayWithDetails } from '@/lib/essays/types';
import type { ScrollkyEssayReason } from '@/lib/feed/scrollky';

/** Feed excerpts stay short so a card fits a phone screen; the full text is one tap away. */
const FEED_SNIPPET_MAX_LENGTH = 320;

const REASON_EYEBROWS: Record<ScrollkyEssayReason, { label: string; icon: React.ElementType; className: string }> = {
  team: {
    label: 'Z tvého týmu',
    icon: Users,
    className: 'text-chart-3-strong border-chart-3/20',
  },
  popular: {
    label: 'Oblíbené tento měsíc',
    icon: Flame,
    className: 'text-warning-strong border-warning/20',
  },
};

const REASON_CARD_CLASSES: Record<ScrollkyEssayReason, string> = {
  team: 'border-chart-3/30 bg-gradient-to-br from-chart-3/5 via-card to-card',
  popular: 'border-warning/30 bg-gradient-to-br from-warning/5 via-card to-card',
};

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
  /** Why the feed picked this essay; renders an eyebrow above the card. */
  reason?: ScrollkyEssayReason | null;
  /** The viewer already opened this essay. */
  isViewed?: boolean;
  className?: string;
  /** Viewer id — only the author sees their frozen (locked) points; others see live book points. */
  currentProfileId?: string | null;
}

export function getEssayGamificationBadge(
  essay: EssayWithDetails,
  authorStats?: AuthorGamificationStats | null,
): { label: string; icon: React.ElementType; className: string } | null {
  if (authorStats?.isTeamTopReader && authorStats.bookPoints > 0) {
    return {
      label: `Největší čtenář:ka týmu · ${authorStats.bookPoints} b.`,
      icon: Trophy,
      className: 'border-warning/30 bg-warning/10 text-warning-strong',
    };
  }

  if (essay.vote_count >= 5 || essay.comment_count >= 3) {
    return {
      label: 'Živá diskuze',
      icon: Flame,
      className: 'border-chart-2/30 bg-chart-2/10 text-chart-2-strong',
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
  reason,
  isViewed = false,
  className,
  currentProfileId,
}: SocialEssayFeedCardProps) {
  const words = countWords(essay.content_text ?? '');
  const readingTime = formatReadingTime(words);
  const relativeTime = formatRelativeTime(essay.created_at);
  const badge = getEssayGamificationBadge(essay, authorStats);
  const snippet = extractEssaySnippet(essay, FEED_SNIPPET_MAX_LENGTH);
  const viewerCanSeeFrozen =
    currentProfileId == null ? true : essay.author_profile_id === currentProfileId;
  const source = getEssaySourceDisplay(essay, { viewerCanSeeFrozen });

  const eyebrow = reason ? REASON_EYEBROWS[reason] : null;

  return (
    <article
      className={cn(
        'group flex flex-col rounded-2xl border bg-card p-4.5 sm:p-5 transition-all hover:border-border hover:shadow-sm space-y-3.5',
        reason && REASON_CARD_CLASSES[reason],
        className,
      )}
    >
      {/* Optional Spotlight Eyebrow */}
      {eyebrow && (
        <div className={cn('flex items-center gap-1.5 border-b pb-1 text-xs font-semibold', eyebrow.className)}>
          <eyebrow.icon className="size-3.5" />
          <span>{eyebrow.label}</span>
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
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{relativeTime}</span>
              {isViewed && (
                <span className="inline-flex items-center gap-0.5 text-success-strong">
                  <Check className="size-3" />
                  Přečteno
                </span>
              )}
            </p>
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
        (() => {
          const { title: bookTitle, fullTitle } = structureBookTitle(essay.book.title_cs);
          return (
            <Link
              href={`/cteni/knihy/${essay.book.id}`}
              className="flex items-center gap-2.5 rounded-xl border bg-muted/40 p-2 transition-colors hover:bg-muted/70"
            >
              <div className="flex h-10 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {essay.book.google_books_cover_url ? (
                  <StorageImage
                    storageKey={essay.book.google_books_cover_url}
                    alt={bookTitle}
                    width={28}
                    height={40}
                    className="size-full object-cover"
                  />
                ) : (
                  <BookOpen className="size-3.5 text-muted-foreground/50" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate min-w-0 text-xs font-medium text-foreground" title={fullTitle}>
                    {bookTitle}
                  </span>
                  <BookStatusBadges book={essay.book} />
                </div>
                <p className="truncate text-[11px] text-muted-foreground">{essay.book.author}</p>
              </div>

              {!source.isArchived && source.points > 0 && (
                source.isFrozen ? (
                  <LegacyPointsBadge points={source.points} className="shrink-0" />
                ) : (
                  <Badge variant="secondary" className="shrink-0 text-xs font-semibold">
                    {formatPoints(source.points)} b.
                  </Badge>
                )
              )}
            </Link>
          );
        })()
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
            <p className="line-clamp-5 text-sm sm:text-[15px] leading-relaxed text-muted-foreground hover:text-foreground transition-colors">
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
