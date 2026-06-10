import Link from 'next/link';
import { BookOpen, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StorageImage } from '@/components/storage/storage-image';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookCardProps {
  book: BookWithProfiles;
}

export function BookCard({ book }: BookCardProps) {
  const points = book.book_points;
  const pointsLabel = `${points} ${points === 1 ? 'bod' : points < 5 ? 'body' : 'bodů'}`;

  return (
    <Link href={`/knihovna/${book.id}`} className="group block">
      <div className="flex gap-3 p-3 rounded-xl border bg-card hover:shadow-sm transition-shadow">
        {/* Portrait cover */}
        <div className="shrink-0 w-14 h-20 rounded-md overflow-hidden bg-muted flex items-center justify-center">
          {book.cover_path ? (
            <StorageImage
              storageKey={book.cover_path}
              alt={book.title}
              className="w-full h-full object-cover"
              width={56}
              height={80}
            />
          ) : (
            <BookOpen className="size-6 text-muted-foreground/40" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div className="space-y-0.5">
            <p className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {book.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">{book.author}</p>
          </div>

          <div className="flex items-center justify-between mt-2 gap-1">
            <div className="flex flex-wrap gap-1 min-w-0">
              {book.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 font-normal">
                  {BOOK_CATEGORY_LABELS[tag] ?? tag}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
              {book.essay_count > 0 && (
                <span className="flex items-center gap-0.5">
                  <FileText className="size-3" />
                  {book.essay_count}
                </span>
              )}
              {book.page_count && book.page_count > 0 && (
                <span>{book.page_count} str.</span>
              )}
              <span className="font-medium text-foreground tabular-nums">{pointsLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
