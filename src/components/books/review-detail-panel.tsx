'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, ExternalLink, Pencil, Rocket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ProfileAvatar } from '@/components/profile-avatar';
import { StorageImage } from '@/components/storage/storage-image';
import { AiVerdictCard } from './ai-verdict-card';
import { BookDescription } from './book-description';
import { BookEditForm } from './book-edit-form';
import { ListStatusBadge, RocketBadge } from './book-status-badges';
import { ReviewDecisionBar } from './review-decision-bar';
import { BOOK_CATEGORY_LABELS, type BookSource, type BookWithProfiles } from '@/lib/books/types';
import type { CoachPoints } from '@/lib/books/points';

const COVER_WIDTH = 112;
const COVER_HEIGHT = 160;
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

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

interface ReviewDetailPanelProps {
  book: BookWithProfiles;
  onApprove: (book: BookWithProfiles, bookPoints: CoachPoints, reason: string) => Promise<boolean>;
  onReject: (book: BookWithProfiles, reason: string) => Promise<boolean>;
  onEdited: (book: BookWithProfiles) => void;
  onDeleted: (bookId: string) => void;
  /** Rendered only on narrow viewports, where the panel replaces the queue. */
  onBack?: () => void;
}

export function ReviewDetailPanel({
  book,
  onApprove,
  onReject,
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

  return (
    <div className="flex flex-col rounded-lg border bg-card">
      {onBack && (
        <div className="border-b p-3 lg:hidden">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="size-4" />
            Zpět na frontu
          </Button>
        </div>
      )}

      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex gap-4 sm:gap-5">
          <div className="flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted shadow-sm ring-1 ring-border">
            {book.google_books_cover_url ? (
              <StorageImage
                storageKey={book.google_books_cover_url}
                alt={book.title_cs}
                className="h-full w-full object-cover"
                width={COVER_WIDTH}
                height={COVER_HEIGHT}
              />
            ) : (
              <BookOpen className="size-8 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/cteni/knihy/${book.id}`}
                  className="text-xl font-semibold leading-tight hover:underline focus-ring"
                >
                  {book.title_cs}
                </Link>
                {book.title_en && book.title_en !== book.title_cs && (
                  <p className="text-sm text-muted-foreground">{book.title_en}</p>
                )}
                <p className="mt-0.5 text-sm text-muted-foreground">{book.author}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                {book.is_rocket_model && <RocketBadge />}
                <ListStatusBadge status={book.list_status} />
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {book.page_count !== null && <MetaChip>{book.page_count} stran</MetaChip>}
              {book.isbn_13 && <MetaChip>ISBN {book.isbn_13}</MetaChip>}
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-primary hover:underline focus-ring"
                >
                  <ExternalLink className="size-3" />
                  {SOURCE_LABELS[book.source]}
                </a>
              ) : (
                <MetaChip>{SOURCE_LABELS[book.source]}</MetaChip>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ProfileAvatar
                picture={book.created_by?.picture}
                name={book.created_by?.name}
                size={AVATAR_SIZE}
              />
              <span>
                Navrhuje {book.created_by?.name ?? 'neznámý student'} · {submittedAt}
              </span>
            </div>
          </div>
        </div>

        <AiVerdictCard points={book.book_points} reason={book.list_status_reason} />

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading>Údaje o knize</SectionHeading>
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
              <div className="flex flex-wrap items-center gap-1.5">
                {book.tags.length > 0 ? (
                  book.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs font-normal">
                      {BOOK_CATEGORY_LABELS[tag] ?? tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Bez štítků</span>
                )}
              </div>
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
        onApprove={onApprove}
        onReject={onReject}
        onEnriched={onEdited}
        onDeleted={onDeleted}
        blocked={isEditing}
      />
    </div>
  );
}
