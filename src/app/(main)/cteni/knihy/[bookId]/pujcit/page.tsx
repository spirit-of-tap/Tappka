import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById } from '@/lib/books/queries';
import { getBookLibraryInfo, getUserActiveLoanDetails } from '@/lib/library/queries';
import { BorrowPanel } from '@/components/library/borrow-panel';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { PageBack } from '@/components/ui/page-back';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Půjčit knihu | Tappka',
};

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export default async function BorrowBookPage({ params }: PageProps) {
  const { bookId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/auth/login');

  const [book, libraryInfo] = await Promise.all([
    getBookById(supabase, bookId),
    getBookLibraryInfo(supabase, bookId),
  ]);

  if (!book) notFound();

  if (!libraryInfo.inLibrary) {
    return (
      <PageShell size="narrow" className="flex flex-col items-center gap-2 py-16 text-center">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{book.title_cs}</h1>
          <BookStatusBadges book={book} />
        </div>
        <p className="text-muted-foreground">Tato kniha není dostupná v TAP Knihovně.</p>
      </PageShell>
    );
  }

  const activeLoan = await getUserActiveLoanDetails(supabase, profile.id, bookId);

  return (
    <PageShell size="narrow" className="space-y-2">
      <PageBack href={`/cteni/knihy/${book.id}`} label="Zpět na detail knihy" />
      <BorrowPanel
        bookId={book.id}
        title={book.title_cs}
        author={book.author}
        coverUrl={book.google_books_cover_url}
        availableCopies={libraryInfo.availableCopies}
        totalCopies={libraryInfo.totalCopies}
        initialDueAt={activeLoan?.due_at ?? null}
        book={{
          list_status: book.list_status,
          is_rocket_model: book.is_rocket_model,
          highlight_category: book.highlight_category,
        }}
      />
    </PageShell>
  );
}
