import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById } from '@/lib/books/queries';
import { Button } from '@/components/ui/button';
import { BookEditForm } from '@/components/books/book-edit-form';

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export default async function BookEditPage({ params }: PageProps) {
  const { bookId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const [profile, book] = await Promise.all([
    getCurrentUserProfile(supabase, { user }),
    getBookById(supabase, bookId),
  ]);

  if (!book) notFound();
  if (profile?.role !== 'coach' && profile?.role !== 'admin') redirect(`/knihovna/${bookId}`);

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-2xl">
      <Button variant="ghost" asChild className="gap-2">
        <Link href={`/knihovna/${bookId}`}>
          <ArrowLeft className="size-4" />
          Zpět na knihu
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">Upravit knihu</h1>
        <p className="text-muted-foreground text-sm mt-1">{book.title}</p>
      </div>
      <BookEditForm book={book} />
    </div>
  );
}
