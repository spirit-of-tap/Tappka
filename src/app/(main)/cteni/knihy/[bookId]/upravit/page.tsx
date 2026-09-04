import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById } from '@/lib/books/queries';
import { BookEditForm } from '@/components/books/book-edit-form';
import { PageHeader } from '@/components/ui/page-header';

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export const metadata = {
  title: 'Upravit knihu',
};

export default async function BookEditPage({ params }: PageProps) {
  const { bookId } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  if (!user) redirect('/auth/login');

  const [profile, book] = await Promise.all([
    getCurrentUserProfile(supabase, { user }),
    getBookById(supabase, bookId),
  ]);

  if (!book) notFound();
  if (profile?.role !== 'coach' && profile?.role !== 'admin') redirect(`/cteni/knihy/${bookId}`);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      <PageHeader
        title="Upravit knihu"
        description={book.title_cs}
        back={{ href: `/cteni/knihy/${bookId}`, label: "Zpět na knihu" }}
      />
      <BookEditForm book={book} />
    </div>
  );
}
