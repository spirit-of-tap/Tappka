import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StorageImage } from '@/components/storage/storage-image';
import { cn } from '@/lib/utils';
import { BOOK_STATUS_LABELS, BOOK_STATUS_COLORS } from '@/lib/books/types';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookCardProps {
  book: BookWithProfiles;
}

export function BookCard({ book }: BookCardProps) {
  const pointsLabel = book.status === 'approved'
    ? `${book.book_points} ${book.book_points === 1 ? 'bod' : book.book_points < 5 ? 'body' : 'bodů'}`
    : book.status === 'rejected'
    ? '0 bodů'
    : `navrhováno ${book.suggested_points}`;

  return (
    <Link href={`/knihovna/${book.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-3">
            <div className="shrink-0 w-16 h-24 bg-muted rounded overflow-hidden flex items-center justify-center">
              {book.cover_path ? (
                <StorageImage
                  storageKey={book.cover_path}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  width={64}
                  height={96}
                />
              ) : (
                <BookOpen className="size-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-sm leading-tight line-clamp-2">{book.title}</p>
              <p className="text-xs text-muted-foreground truncate">{book.author}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge
                  variant="outline"
                  className={cn('text-xs', BOOK_STATUS_COLORS[book.status])}
                >
                  {book.status === 'rejected' ? 'Zamítnuto / 0 bodů' : BOOK_STATUS_LABELS[book.status]}
                </Badge>
                {book.status !== 'rejected' && (
                  <Badge variant="secondary" className="text-xs">
                    {pointsLabel}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {book.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
