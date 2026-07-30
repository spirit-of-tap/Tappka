import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById } from '@/lib/books/queries';
import { getBookLibraryInfo, getUserActiveLoanDetails } from '@/lib/library/queries';
import { BorrowPanel } from '@/components/library/borrow-panel';
import { PageShell } from '@/components/ui/page-shell';

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
        <h1 className="text-xl font-bold">{book.title_cs}</h1>
        <p className="text-muted-foreground">Tato kniha není dostupná v TAP Knihovně.</p>
      </PageShell>
    );
  }

  const activeLoan = await getUserActiveLoanDetails(supabase, profile.id, bookId);

  return (
    <PageShell size="narrow" className="space-y-2">
      <Link
        href={`/knihovna/${book.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět na detail knihy
      </Link>
      <BorrowPanel
        bookId={book.id}
        title={book.title_cs}
        author={book.author}
        coverUrl={book.google_books_cover_url}
        availableCopies={libraryInfo.availableCopies}
        totalCopies={libraryInfo.totalCopies}
        initialDueAt={activeLoan?.due_at ?? null}
      />
    </PageShell>
  );
}
