import Link from 'next/link';
import { BookOpen, FileText, ExternalLink, Library } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from './book-status-badges';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { formatPointsWithLabel } from '@/lib/books/points';
import { structureBookTitle } from '@/lib/books/format-title';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookCardProps {
  book: BookWithProfiles;
  libraryInfo?: { totalCopies: number; availableCopies: number; inLibrary: boolean } | null;
}

export function BookCard({ book, libraryInfo }: BookCardProps) {
  const pointsLabel = formatPointsWithLabel(book.book_points);
  const { title: bookTitle, fullTitle } = structureBookTitle(book.title_cs);

  return (
    <div className="flex gap-3 px-3 py-2.5 rounded-xl border bg-card hover:shadow-sm transition-shadow group">
      <Link href={`/cteni/knihy/${book.id}`} className="focus-ring shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
        {book.google_books_cover_url ? (
          <StorageImage
            storageKey={book.google_books_cover_url}
            alt={bookTitle}
            className="w-full h-full object-cover"
            width={40}
            height={56}
          />
        ) : (
          <BookOpen className="size-4 text-muted-foreground/40" />
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <Link href={`/cteni/knihy/${book.id}`} className="flex items-center gap-1.5 min-w-0">
          <p className="font-semibold text-sm leading-snug truncate min-w-0 group-hover:text-primary transition-colors" title={fullTitle}>
            {bookTitle}
          </p>
          <BookStatusBadges book={book} />
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
          {libraryInfo?.inLibrary && (
            <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400">
              <Library className="size-3" />
              TAP Knihovna
              <span className="text-indigo-400 dark:text-indigo-500">·</span>
              {libraryInfo.availableCopies} dostupných kopií
            </span>
          )}
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
