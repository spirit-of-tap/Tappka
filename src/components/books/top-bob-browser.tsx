import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';
import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from './book-status-badges';
import { formatPointsWithLabel } from '@/lib/books/points';
import type { BookWithProfiles } from '@/lib/books/types';
import type { HighlightedGroup } from '@/lib/books/highlight-groups';

interface TopBobBrowserProps {
  groups: HighlightedGroup[];
}

export function TopBobBrowser({ groups }: TopBobBrowserProps) {
  return (
    <div className="space-y-8">
      {groups.map(({ category, books }) => {
        const totalEssays = books.reduce((sum, b) => sum + b.essay_count, 0);
        return (
          <section key={category.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-base">{category.name}</h2>
                {category.description && (
                  <p className="text-sm text-muted-foreground">{category.description}</p>
                )}
              </div>
              {totalEssays > 0 && (
                <span className="shrink-0 text-xs text-muted-foreground">{totalEssays} esejí</span>
              )}
            </div>

            <div className="divide-y rounded-xl border overflow-hidden bg-card">
              {books.map((book) => (
                <TopBobBookRow key={book.id} book={book} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TopBobBookRow({ book }: { book: BookWithProfiles }) {
  return (
    <div className="group flex gap-3 px-3 py-3">
      <Link
        href={`/cteni/knihy/${book.id}`}
        className="mt-0.5 flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
      >
        {book.google_books_cover_url ? (
          <StorageImage
            storageKey={book.google_books_cover_url}
            alt={book.title_cs}
            width={44}
            height={64}
            className="h-full w-full object-cover"
          />
        ) : (
          <BookOpen className="size-4 text-muted-foreground/30" />
        )}
      </Link>
      <div className="min-w-0 flex-1 space-y-1 py-0.5">
        <Link href={`/cteni/knihy/${book.id}`} className="flex items-center gap-1.5">
          <p className="line-clamp-1 text-sm font-medium leading-snug transition-colors group-hover:text-primary">
            {book.title_cs}
          </p>
          <BookStatusBadges book={book} />
        </Link>
        {book.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{book.description}</p>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">{formatPointsWithLabel(book.book_points)}</span>
          {book.essay_count > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground">{book.essay_count} esejí</span>
            </>
          )}
          {book.preview_link && (
            <a
              href={book.preview_link}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-0.5 text-primary hover:underline"
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
