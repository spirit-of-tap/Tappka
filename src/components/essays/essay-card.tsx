import Link from 'next/link';
import { MessageCircle, Eye, BookOpen, ChevronUp, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfileAvatar } from '@/components/profile-avatar';
import { EssayVoteButton } from './essay-vote-button';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { ContentSourceIllustration, CONTENT_SOURCE_KIND_ICONS } from '@/components/content-sources/content-source-illustration';
import { formatPoints } from '@/lib/books/points';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import type { EssayWithDetails } from '@/lib/essays/types';

interface EssayCardProps {
  essay: EssayWithDetails;
  showVoteButton?: boolean;
  initialVoted?: boolean;
}

export function EssayCard({ essay, showVoteButton = false, initialVoted = false }: EssayCardProps) {
  const snippet = (essay.content_text ?? '').slice(0, 160).trimEnd();
  const source = getEssaySourceDisplay(essay);
  const authorInitial = essay.author?.name?.[0]?.toUpperCase() ?? '?';
  // The icon sits next to the source's own title, so it has to describe the
  // source — a podcast row showing a book glyph reads as a mislabelled essay.
  const SourceIcon = essay.content_source
    ? CONTENT_SOURCE_KIND_ICONS[essay.content_source.kind]
    : BookOpen;

  return (
    <Link href={`/cteni/eseje/${essay.id}`} className="group block h-full">
      <Card className="h-full transition-all group-hover:shadow-md group-hover:border-border/80 py-0">
        <CardContent className="px-4 py-3 flex flex-col h-full gap-2">

          {/* Author row */}
          <div className="flex items-center gap-2">
            {essay.author?.picture ? (
              <ProfileAvatar picture={essay.author.picture} name={essay.author.name} size={24} />
            ) : (
              <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0">
                {authorInitial}
              </div>
            )}
            <span className="text-xs text-muted-foreground truncate">{essay.author?.name}</span>
          </div>

          {/* Title + snippet + optional cover */}
          <div className="flex-1 flex gap-3">
            <div className="flex-1 space-y-1.5 min-w-0">
              <h3 className="font-bold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {essay.title}
              </h3>
              {snippet && (
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{snippet}</p>
              )}
            </div>
            {essay.book?.google_books_cover_url ? (
              <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-muted">
                <StorageImage
                  storageKey={essay.book.google_books_cover_url}
                  alt={essay.book.title_cs}
                  width={40}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : source.illustrationKind ? (
              <ContentSourceIllustration kind={source.illustrationKind as never} className="shrink-0 w-10 h-14" />
            ) : null}
          </div>

          {/* Source (book or content source) */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-2">
            {source.kind !== 'none' ? (
              <>
                <SourceIcon className="size-3 shrink-0" />
                <span className="truncate">{source.title}</span>
                {essay.book && <BookStatusBadges book={essay.book} />}
                {!source.isArchived && source.points > 0 && (
                  <span className="shrink-0 ml-auto font-medium text-foreground">{formatPoints(source.points)} b.</span>
                )}
                {source.isArchived && (
                  <span className="shrink-0 ml-auto text-destructive">0 b.</span>
                )}
              </>
            ) : (
              <>
                <Sparkles className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-700 dark:text-amber-300">Nad rámec četby</span>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {showVoteButton ? (
              <EssayVoteButton
                essayId={essay.id}
                initialVoteCount={essay.vote_count}
                initialVoted={initialVoted}
              />
            ) : (
              <span className="flex items-center gap-1">
                <ChevronUp className="size-3" />
                {essay.vote_count}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="size-3" />
              {essay.view_count}
            </span>
            {essay.comment_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" />
                {essay.comment_count}
              </span>
            )}
            <span className="ml-auto">
              {new Date(essay.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}
            </span>
          </div>

        </CardContent>
      </Card>
    </Link>
  );
}
