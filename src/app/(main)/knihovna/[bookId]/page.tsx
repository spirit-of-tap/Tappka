import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  BookText,
  Hash,
  User,
  Pencil,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById, getBookComments } from '@/lib/books/queries';
import { getEssays } from '@/lib/essays/queries';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfilePicture } from '@/components/profile-picture';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookDeleteButton } from '@/components/books/book-delete-button';
import { BookDescription } from '@/components/books/book-description';
import { BookEssaysList } from '@/components/books/book-essays-list';
import { BOOK_STATUS_LABELS, BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { formatPointsWithLabel } from '@/lib/books/points';
import type { BookStatus } from '@/lib/books/types';
import { cn } from '@/lib/utils';

const ALL_ESSAYS_PAGE_SIZE = 500;

const STATUS_PILL: Record<BookStatus, string> = {
  approved:
    'border-emerald-600/20 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-950/40 dark:text-emerald-400',
  pending:
    'border-amber-600/20 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-950/40 dark:text-amber-400',
  rejected:
    'border-red-600/20 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-950/40 dark:text-red-400',
};

const STATUS_DOT: Record<BookStatus, string> = {
  approved: 'bg-emerald-500',
  pending: 'bg-amber-500',
  rejected: 'bg-red-500',
};

interface PageProps {
  params: Promise<{ bookId: string }>;
}


function Avatar({ picture, name, size = 28 }: { picture?: string | null; name?: string | null; size?: number }) {
  const initial = name?.[0]?.toUpperCase() ?? '?';
  const dimClass = size <= 28 ? 'size-7' : size <= 32 ? 'size-8' : 'size-10';
  const imageSize = size <= 28 ? 28 : size <= 32 ? 32 : 40;
  if (picture) {
    return (
      <ProfilePicture
        src={picture}
        alt={name ?? ''}
        size={imageSize}
        className={`rounded-full object-cover shrink-0 ${dimClass}`}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0 ${dimClass} text-xs`}
    >
      {initial}
    </div>
  );
}

function MetaItem({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0 text-muted-foreground/70" />
      <span>{children}</span>
    </div>
  );
}

export default async function BookDetailPage({ params }: PageProps) {
  const { bookId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [book, comments, essays, profile] = await Promise.all([
    getBookById(supabase, bookId),
    getBookComments(supabase, bookId),
    getEssays(supabase, { bookId, pageSize: ALL_ESSAYS_PAGE_SIZE, sort: 'best' }),
    user ? getCurrentUserProfile(supabase, { user }) : null,
  ]);

  if (!book) notFound();

  const isCoachOrAdmin = profile?.role === 'coach' || profile?.role === 'admin';

  const previewUrl = book.preview_link ? book.preview_link.replace(/^http:\/\//, 'https://') : null;
  const goodreadsUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(book.title_cs)}`;

  return (
    <div className="container mx-auto max-w-4xl py-6 space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" asChild className="gap-2 -ml-2">
          <Link href="/hledat">
            <ArrowLeft className="size-4" />
            Zpět do knihovny
          </Link>
        </Button>
        {isCoachOrAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="gap-2">
              <Link href={`/knihovna/${book.id}/upravit`}>
                <Pencil className="size-4" />
                Upravit
              </Link>
            </Button>
            <BookDeleteButton bookId={book.id} bookTitle={book.title_cs} />
          </div>
        )}
      </div>

      {/* Hero */}
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="mx-auto shrink-0 sm:mx-0">
          <div className="flex aspect-[2/3] w-44 items-center justify-center overflow-hidden rounded-xl bg-muted shadow-lg ring-1 ring-border/50">
            {book.google_books_cover_url ? (
              <StorageImage
                storageKey={book.google_books_cover_url}
                alt={book.title_cs}
                className="h-full w-full object-cover"
                width={176}
                height={264}
              />
            ) : (
              <BookOpen className="size-14 text-muted-foreground/60" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">{book.title_cs}</h1>
            <p className="text-lg text-muted-foreground">{book.author}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                STATUS_PILL[book.status],
              )}
            >
              <span className={cn('size-1.5 rounded-full', STATUS_DOT[book.status])} />
              {BOOK_STATUS_LABELS[book.status]}
            </span>
            {book.status === 'approved' ? (
              <span className="inline-flex items-center rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
                {formatPointsWithLabel(book.book_points)}
              </span>
            ) : book.status === 'rejected' ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                0 bodů
              </span>
            ) : null}
          </div>

          {book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {BOOK_CATEGORY_LABELS[tag] ?? tag}
                </span>
              ))}
            </div>
          )}

          {/* Metadata strip */}
          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-4">
            {book.page_count != null && <MetaItem icon={BookText}>{book.page_count} stran</MetaItem>}
            {book.isbn_13 && <MetaItem icon={Hash}>ISBN {book.isbn_13}</MetaItem>}
            {book.created_by?.name && <MetaItem icon={User}>Přidal/a {book.created_by.name}</MetaItem>}
          </dl>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {previewUrl && (
              <Button asChild className="gap-2">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  Náhled na Google Books
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="gap-2">
              <a href={goodreadsUrl} target="_blank" rel="noopener noreferrer">
                Goodreads
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </div>

          {/* Description */}
          {book.description && (
            <div className="border-t border-border/60 pt-4">
              <BookDescription text={book.description} />
            </div>
          )}
          {book.status_reason && (
            <p className="text-sm text-destructive">Důvod zamítnutí: {book.status_reason}</p>
          )}
        </div>
      </div>

      {/* Essays */}
      {essays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eseje o této knize ({essays.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <BookEssaysList essays={essays} />
          </CardContent>
        </Card>
      )}

      {/* Comments */}
      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Komentáře ({comments.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar picture={comment.author?.picture} name={comment.author?.name} size={32} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-xs font-medium">{comment.author?.name}</p>
                  <p className="text-sm leading-relaxed">{comment.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
