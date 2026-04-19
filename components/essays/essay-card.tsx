import Link from 'next/link';
import { MessageCircle, Eye, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BOOK_STATUS_COLORS } from '@/lib/books/types';
import { cn } from '@/lib/utils';
import type { EssayWithDetails } from '@/lib/essays/types';

interface EssayCardProps {
  essay: EssayWithDetails;
}

export function EssayCard({ essay }: EssayCardProps) {
  const snippet = (essay.content_text ?? '').slice(0, 150);

  return (
    <Link href={`/eseje/${essay.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm line-clamp-2">{essay.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">{essay.author?.name}</p>
          </div>
          {snippet && (
            <p className="text-xs text-muted-foreground line-clamp-3">{snippet}</p>
          )}
          {essay.book && (
            <div className={cn('flex items-center gap-1.5 text-xs px-2 py-1 rounded-md w-fit', BOOK_STATUS_COLORS[essay.book.status])}>
              <BookOpen className="size-3" />
              <span className="truncate max-w-[140px]">{essay.book.title}</span>
              {essay.book.status === 'approved' && (
                <span className="shrink-0">&middot; {essay.book.book_points} b.</span>
              )}
              {essay.book.status === 'rejected' && (
                <span className="shrink-0">&middot; 0 b.</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="size-3" />
              <span>{essay.view_count}</span>
            </div>
            {essay.comment_count !== undefined && (
              <div className="flex items-center gap-1">
                <MessageCircle className="size-3" />
                <span>{essay.comment_count}</span>
              </div>
            )}
            <span className="ml-auto">
              {new Date(essay.created_at).toLocaleDateString('cs-CZ')}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
