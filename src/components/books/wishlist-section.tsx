'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { StorageImage } from '@/components/storage/storage-image';
import { useWishlistOptional } from '@/components/books/wishlist-provider';
import { structureBookTitle } from '@/lib/books/format-title';
import type { BookWithProfiles } from '@/lib/books/types';

interface WishlistSectionProps {
  books: BookWithProfiles[];
}

/**
 * A light cover shelf on Moje. Deliberately not a full list section: it sits
 * between loans and essays, so it stays one row tall and disappears when empty
 * (the bookmark on every book card is the entry point). Removal happens on the
 * book detail, where the saved state is labeled.
 */
export function WishlistSection({ books }: WishlistSectionProps) {
  const wishlist = useWishlistOptional();

  // Outside the provider (isolated rendering) every passed book belongs to the
  // shelf; inside it, a removal elsewhere immediately drops the cover.
  const visibleBooks = wishlist ? books.filter((book) => wishlist.isSaved(book.id)) : books;

  if (visibleBooks.length === 0) return null;

  return (
    <section aria-labelledby="wishlist-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="wishlist-heading" className="text-sm font-semibold">
          Chci si přečíst{' '}
          <span className="font-normal text-muted-foreground">{visibleBooks.length}</span>
        </h2>
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground">
          <Link href="/cteni/hledat">
            Objevovat
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>

      <ul className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {visibleBooks.map((book) => {
          const { title, fullTitle } = structureBookTitle(book.title_cs);

          return (
            <li key={book.id} className="w-20 shrink-0">
              <Link
                href={`/cteni/knihy/${book.id}`}
                className="group block space-y-1.5 rounded-md focus-ring"
                title={fullTitle}
              >
                <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border/50 transition-shadow group-hover:shadow-sm">
                  {book.google_books_cover_url ? (
                    <StorageImage
                      storageKey={book.google_books_cover_url}
                      alt=""
                      className="size-full object-cover"
                      width={80}
                      height={120}
                    />
                  ) : (
                    <BookOpen className="size-5 text-muted-foreground/40" aria-hidden="true" />
                  )}
                </div>
                <p className="line-clamp-2 text-xs leading-tight group-hover:text-primary transition-colors">
                  {title}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
