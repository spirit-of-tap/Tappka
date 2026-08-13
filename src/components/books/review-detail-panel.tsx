'use client';

import { useState, type ElementType, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, BookText, ExternalLink, Pencil, Rocket, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileAvatar } from '@/components/profile-avatar';
import { StorageImage } from '@/components/storage/storage-image';
import { BookDescription } from './book-description';
import { BookEditForm } from './book-edit-form';
import { ListStatusBadge, RocketBadge } from './book-status-badges';
import { ReviewDecisionBar } from './review-decision-bar';
import { BOOK_CATEGORY_LABELS, type BookSource, type BookWithProfiles } from '@/lib/books/types';
import type { ReviewPoints } from '@/lib/books/points';

const COVER_WIDTH = 176;
const COVER_HEIGHT = 264;
const AVATAR_SIZE = 20;

const SOURCE_LABELS: Record<BookSource, string> = {
  google_books: 'Google Books',
  open_library: 'Open Library',
  manual: 'Ručně zadáno',
};

/** Rebuilds the provider's own URL from the stored `external_id`. */
function externalUrl(book: BookWithProfiles): string | null {
  if (!book.external_id) return null;
  if (book.source === 'google_books') return `https://books.google.com/books?id=${book.external_id}`;
  if (book.source === 'open_library') return `https://openlibrary.org${book.external_id}`;
  return null;
}

/** The book detail page's pill. Repeated here so both screens read as one product. */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function MetaItem({ icon: Icon, children }: { icon: ElementType; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0 text-muted-foreground/70" />
      <span className="truncate">{children}</span>
    </div>
  );
}

interface ReviewDetailPanelProps {
  book: BookWithProfiles;
  /** 0 archives the book, 1–3 approve it into the longlist. */
  onDecide: (book: BookWithProfiles, points: ReviewPoints, reason: string) => Promise<boolean>;
  onEdited: (book: BookWithProfiles) => void;
  onDeleted: (bookId: string) => void;
  /** Rendered only on narrow viewports, where the panel replaces the queue. */
  onBack?: () => void;
}

export function ReviewDetailPanel({
  book,
  onDecide,
  onEdited,
  onDeleted,
  onBack,
}: ReviewDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  const sourceUrl = externalUrl(book);
  const submittedAt = new Date(book.created_at).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  // `h-full` so a short book still fills the row a long queue sets, which keeps the
  // decision bar anchored to the bottom of the card rather than floating mid-column.
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      {onBack && (
        <div className="border-b p-3 lg:hidden">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-2">
            <ArrowLeft className="size-4" />
            Zpět na frontu
          </Button>
        </div>
      )}

      <div className="flex-1 space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-7">
          <div className="mx-auto shrink-0 sm:mx-0">
            <div className="flex aspect-[2/3] w-32 items-center justify-center overflow-hidden rounded-xl bg-muted shadow-lg ring-1 ring-border/50 sm:w-40">
              {book.google_books_cover_url ? (
                <StorageImage
                  storageKey={book.google_books_cover_url}
                  alt={book.title_cs}
                  className="h-full w-full object-cover"
                  width={COVER_WIDTH}
                  height={COVER_HEIGHT}
                />
              ) : (
                <BookOpen className="size-12 text-muted-foreground/60" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/cteni/knihy/${book.id}`}
                  className="text-2xl font-bold leading-tight tracking-tight hover:underline focus-ring"
                >
                  {book.title_cs}
                </Link>
                <span className="flex shrink-0 items-center gap-1.5 pt-1">
                  {book.is_rocket_model && <RocketBadge />}
                  <ListStatusBadge status={book.list_status} />
                </span>
              </div>
              {book.title_en && book.title_en !== book.title_cs && (
                <p className="text-sm text-muted-foreground/80">{book.title_en}</p>
              )}
              <p className="text-lg text-muted-foreground">{book.author}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {book.tags.length > 0 &&
                book.tags.map((tag) => <Pill key={tag}>{BOOK_CATEGORY_LABELS[tag] ?? tag}</Pill>)}
              {book.isbn_13 && <Pill>ISBN {book.isbn_13}</Pill>}
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-primary hover:underline focus-ring"
                >
                  {SOURCE_LABELS[book.source]}
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <Pill>{SOURCE_LABELS[book.source]}</Pill>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {book.page_count !== null && (
                <MetaItem icon={BookText}>{book.page_count} stran</MetaItem>
              )}
              <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                {book.created_by ? (
                  <ProfileAvatar
                    picture={book.created_by.picture}
                    name={book.created_by.name}
                    size={AVATAR_SIZE}
                  />
                ) : (
                  <User className="size-4 shrink-0 text-muted-foreground/70" />
                )}
                <span className="truncate">
                  {book.created_by?.name ?? 'Neznámý:á student:ka'} · {submittedAt}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/60 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Údaje o knize
            </h3>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5">
                <Pencil className="size-3.5" />
                Upravit
              </Button>
            )}
          </div>

          {isEditing ? (
            <BookEditForm
              book={book}
              onSaved={(saved) => {
                onEdited(saved);
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <div className="space-y-3">
              {book.description ? (
                <BookDescription text={book.description} />
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  Kniha nemá popis — zkus Dohledat údaje, nebo ho doplň ručně.
                </p>
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Rocket className="size-3.5" />
                Raketový model: {book.is_rocket_model ? 'ano' : 'ne'}
              </p>
            </div>
          )}
        </div>
      </div>

      <ReviewDecisionBar
        book={book}
        onDecide={onDecide}
        onEnriched={onEdited}
        onDeleted={onDeleted}
        blocked={isEditing}
      />
    </div>
  );
}
