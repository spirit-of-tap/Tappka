import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  BookText,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById, getBookComments } from '@/lib/books/queries';
import { getEssays } from '@/lib/essays/queries';
import { getBookCopiesStatus, getBookLibraryInfo } from '@/lib/library/queries';
import { LibraryStatusBadge } from '@/components/library/library-status-badge';
import { BookCopiesList } from '@/components/library/book-copies-list';
import { StorageImage } from '@/components/storage/storage-image';
import { ProfilePicture } from '@/components/profile-picture';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/ui/page-shell';
import { BookAdminActions } from './admin-actions';
import { BookDescription } from '@/components/books/book-description';
import { BookEssaysList } from '@/components/books/book-essays-list';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';
import { formatPointsWithLabel } from '@/lib/books/points';

const ALL_ESSAYS_PAGE_SIZE = 500;

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

  const [book, comments, essays, profile, libraryInfo, copies] = await Promise.all([
    getBookById(supabase, bookId),
    getBookComments(supabase, bookId),
    getEssays(supabase, { bookId, pageSize: ALL_ESSAYS_PAGE_SIZE, sort: 'best' }),
    user ? getCurrentUserProfile(supabase, { user }) : null,
    getBookLibraryInfo(supabase, bookId),
    getBookCopiesStatus(supabase, bookId),
  ]);

  if (!book) notFound();

  const isCoachOrAdmin = profile?.role === 'coach' || profile?.role === 'admin';

  const previewUrl = book.preview_link ? book.preview_link.replace(/^http:\/\//, 'https://') : null;
  const goodreadsUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(book.title_cs)}`;

  return (
    <PageShell size="wide" className="space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" asChild className="gap-2 -ml-2">
          <Link href="/hledat">
            <ArrowLeft className="size-4" />
            Zpět do hledání
          </Link>
        </Button>
        <BookAdminActions
          bookId={book.id}
          bookTitle={book.title_cs}
          goodreadsUrl={goodreadsUrl}
          isCoachOrAdmin={isCoachOrAdmin}
          createdByName={book.created_by?.name}
        />
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
          {previewUrl && (
            <Button asChild variant="outline" className="w-44 mt-3">
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                Náhled
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">{book.title_cs}</h1>
            <p className="text-lg text-muted-foreground">{book.author}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {book.status === 'approved' ? (
              <span className="inline-flex items-center rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
                {formatPointsWithLabel(book.book_points)}
              </span>
            ) : book.status === 'pending' ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Čeká na schválení
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                0 b.
              </span>
            )}
            {book.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {BOOK_CATEGORY_LABELS[tag] ?? tag}
              </span>
            ))}
          </div>

          {/* Description — what the book is about, the first thing a student wants to know */}
          {book.description && (
            <div className="border-t border-border/60 pt-4">
              <BookDescription text={book.description} />
            </div>
          )}
          {book.page_count != null && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              <MetaItem icon={BookText}>{book.page_count} stran</MetaItem>
            </div>
          )}
        </div>
      </div>

      {/* TAP Knihovna copies */}
      {libraryInfo.inLibrary && (
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold">
            <BookOpen className="size-4 text-muted-foreground" />
            TAP Knihovna
          </h2>
          <BookCopiesList copies={copies} />
        </div>
      )}

      {/* Essays */}
      {essays.length > 0 && (
        <div className="border-t border-border/60 pt-6">
          <h2 className="text-base font-bold mb-4">Co o knize napsali ostatní ({essays.length})</h2>
          <BookEssaysList essays={essays} />
        </div>
      )}

      {/* Comments */}
      {comments.length > 0 && (
        <div className="border-t border-border/60 pt-6 space-y-4">
          <h2 className="text-base font-bold">Komentáře ({comments.length})</h2>
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar picture={comment.author?.picture} name={comment.author?.name} size={32} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-medium">{comment.author?.name}</p>
                <p className="text-sm leading-relaxed">{comment.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
