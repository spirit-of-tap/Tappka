import Link from 'next/link';
import { MessageCircle, Eye, BookOpen, FileQuestion, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StorageImage } from '@/components/storage/storage-image';
import { EssayVoteButton } from './essay-vote-button';
import { formatPoints, pointsNumber } from '@/lib/books/points';
import type { EssayWithDetails } from '@/lib/essays/types';

interface EssayCardProps {
  essay: EssayWithDetails;
  showVoteButton?: boolean;
  initialVoted?: boolean;
}

export function EssayCard({ essay, showVoteButton = false, initialVoted = false }: EssayCardProps) {
  const snippet = (essay.content_text ?? '').slice(0, 160).trimEnd();
  const authorInitial = essay.author?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <Link href={`/eseje/${essay.id}`} className="group block h-full">
      <Card className="h-full transition-all group-hover:shadow-md group-hover:border-border/80 py-0">
        <CardContent className="px-4 py-3 flex flex-col h-full gap-2">

          {/* Author row */}
          <div className="flex items-center gap-2">
            {essay.author?.picture ? (
              <img src={essay.author.picture} alt={essay.author.name} className="size-6 rounded-full object-cover shrink-0" />
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
            {essay.book?.cover_path && (
              <div className="shrink-0 w-10 h-14 rounded overflow-hidden bg-muted">
                <StorageImage
                  storageKey={essay.book.cover_path}
                  alt={essay.book.title}
                  width={40}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Book source */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-2">
            {essay.book ? (
              <>
                <BookOpen className="size-3 shrink-0" />
                <span className="truncate">{essay.book.title}</span>
                {essay.book.status === 'approved' && pointsNumber(essay.book.book_points) > 0 && (
                  <span className="shrink-0 ml-auto font-medium text-foreground">{formatPoints(essay.book.book_points)} b.</span>
                )}
                {essay.book.status === 'rejected' && (
                  <span className="shrink-0 ml-auto text-destructive">0 b.</span>
                )}
              </>
            ) : (
              <>
                <FileQuestion className="size-3 shrink-0" />
                <span className="italic">Bez zdroje</span>
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
