import Link from 'next/link';
import { BookOpen, FileText, ExternalLink } from 'lucide-react';
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
    <div className="flex gap-3 px-3 py-2.5 rounded-xl border bg-card hover:shadow-sm transition-shadow group">
      <Link href={`/knihovna/${book.id}`} className="shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {book.cover_path ? (
          <StorageImage
            storageKey={book.cover_path}
            alt={book.title}
            className="w-full h-full object-cover"
            width={40}
            height={56}
          />
        ) : (
          <BookOpen className="size-4 text-muted-foreground/40" />
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <Link href={`/knihovna/${book.id}`}>
          <p className="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors">
            {book.title}
          </p>
        </Link>
        <p className="text-xs text-muted-foreground truncate">{book.author}</p>

        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {book.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 font-normal">
              {BOOK_CATEGORY_LABELS[tag] ?? tag}
            </Badge>
          ))}
          <span className="text-muted-foreground/40 text-xs">·</span>
          {book.essay_count > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <FileText className="size-3" />{book.essay_count}
            </span>
          )}
          {book.page_count && book.page_count > 0 && (
            <span className="text-xs text-muted-foreground">{book.page_count} str.</span>
          )}
          <span className="text-xs font-medium text-foreground">{pointsLabel}</span>
          {book.preview_link && (
            <a
              href={book.preview_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline flex items-center gap-0.5 ml-auto"
            >
              <ExternalLink className="size-3" />
              Náhled
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
