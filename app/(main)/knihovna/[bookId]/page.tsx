import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserProfile } from '@/lib/auth-helpers';
import { getBookById, getBookComments } from '@/lib/books/queries';
import { getEssays } from '@/lib/essays/queries';
import { StorageImage } from '@/components/storage/storage-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookDeleteButton } from '@/components/books/book-delete-button';
import { Pencil } from 'lucide-react';
import { BOOK_STATUS_LABELS, BOOK_STATUS_COLORS } from '@/lib/books/types';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ bookId: string }>;
}

export default async function BookDetailPage({ params }: PageProps) {
  const { bookId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [book, comments, essays, profile] = await Promise.all([
    getBookById(supabase, bookId),
    getBookComments(supabase, bookId),
    getEssays(supabase, { bookId, pageSize: 500 }),
    user ? getCurrentUserProfile(supabase, { user }) : null,
  ]);

  if (!book) notFound();

  const isCoachOrAdmin = profile?.role === 'coach' || profile?.role === 'admin';

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/knihovna">
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
            <BookDeleteButton bookId={book.id} bookTitle={book.title} />
          </div>
        )}
      </div>

      <div className="flex gap-6">
        <div className="shrink-0 w-32 h-48 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
          {book.cover_path ? (
            <StorageImage
              storageKey={book.cover_path}
              alt={book.title}
              className="w-full h-full object-cover"
              width={128}
              height={192}
            />
          ) : (
            <BookOpen className="size-12 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 space-y-3">
          <h1 className="text-2xl font-bold">{book.title}</h1>
          <p className="text-muted-foreground">{book.author}</p>
          {book.isbn_13 && (
            <p className="text-xs text-muted-foreground">ISBN: {book.isbn_13}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge className={cn(BOOK_STATUS_COLORS[book.status])}>
              {book.status === 'rejected' ? 'Zamítnuto / 0 bodů' : BOOK_STATUS_LABELS[book.status]}
            </Badge>
            {book.status === 'approved' && (
              <Badge variant="secondary">{book.book_points} {book.book_points === 1 ? 'bod' : 'body'}</Badge>
            )}
          </div>
          {book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {book.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
          {book.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{book.description}</p>
          )}
          {book.rejection_reason && (
            <p className="text-sm text-destructive">Důvod zamítnutí: {book.rejection_reason}</p>
          )}
        </div>
      </div>

      {essays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eseje o této knize ({essays.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {essays.map((essay) => (
              <Link key={essay.id} href={`/eseje/${essay.id}`} className="block hover:bg-muted p-3 rounded-lg transition-colors">
                <p className="font-medium text-sm">{essay.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{essay.author?.name}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Komentáře ({comments.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="space-y-1">
                <p className="text-xs font-medium">{comment.author?.name}</p>
                <p className="text-sm">{comment.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
