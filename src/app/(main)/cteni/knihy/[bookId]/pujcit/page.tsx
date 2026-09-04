import { notFound, redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById } from '@/lib/books/queries';
import { parseLibraryLabelCode } from '@/lib/library/label-code';
import {
  getAvailableCopyByLabelCode,
  getBookLibraryInfo,
  getLibraryCopyByLabelCode,
  getUserActiveLoanDetails,
} from '@/lib/library/queries';
import { BorrowPanel } from '@/components/library/borrow-panel';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { PageBack } from '@/components/ui/page-back';
import { PageShell } from '@/components/ui/page-shell';

export const metadata = {
  title: 'Půjčit knihu',
};

interface PageProps {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ label?: string }>;
}

export default async function BorrowBookPage({ params, searchParams }: PageProps) {
  const { bookId } = await params;
  const { label: rawLabelCode } = await searchParams;
  const labelCode = rawLabelCode == null ? null : parseLibraryLabelCode(rawLabelCode);
  if (rawLabelCode != null && labelCode == null) notFound();

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const profile = await getCurrentUserProfile(supabase, { user });
  if (!profile) redirect('/auth/login');

  const [book, libraryInfo] = await Promise.all([
    getBookById(supabase, bookId),
    getBookLibraryInfo(supabase, bookId),
  ]);

  if (!book) notFound();

  let selectedCopyAvailable: boolean | null = null;
  if (labelCode != null) {
    const selectedCopy = await getLibraryCopyByLabelCode(supabase, labelCode);
    if (!selectedCopy || selectedCopy.bookId !== bookId) notFound();
    selectedCopyAvailable = (await getAvailableCopyByLabelCode(supabase, bookId, labelCode)) != null;
  }

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
        availableCopies={selectedCopyAvailable == null ? libraryInfo.availableCopies : Number(selectedCopyAvailable)}
        totalCopies={selectedCopyAvailable == null ? libraryInfo.totalCopies : 1}
        labelCode={labelCode}
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
