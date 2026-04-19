import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getBooks } from '@/lib/books/queries';
import { BookCard } from '@/components/books/book-card';
import { LibraryFilters } from '@/components/books/library-filters';
import { LoadMoreBooks } from '@/components/books/load-more-books';
import { Button } from '@/components/ui/button';
import type { BookStatus } from '@/lib/books/types';

interface PageProps {
  searchParams: Promise<{
    status?: BookStatus;
    q?: string;
    tag?: string | string[];
    page?: string;
  }>;
}

export default async function KnihovnaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const tags = params.tag
    ? Array.isArray(params.tag) ? params.tag : [params.tag]
    : undefined;

  const books = await getBooks(supabase, {
    status: params.status ?? 'approved',
    search: params.q,
    tags,
    sortBy: 'popular',
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">Knihovna</h1>
          <p className="text-muted-foreground">Katalog knih pro studenty Tiimiakatemia</p>
        </div>
        <Button asChild>
          <Link href="/knihovna/nova">
            <Plus className="size-4 mr-2" />
            Přidat knihu
          </Link>
        </Button>
      </div>

      <Suspense>
        <LibraryFilters />
      </Suspense>

      {books.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <BookOpen className="size-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold text-lg">Žádné knihy</h3>
          <p className="text-sm text-muted-foreground">
            {params.q || params.tag ? 'Žádné výsledky pro zvolené filtry' : 'Buď první, kdo přidá knihu do katalogu'}
          </p>
          {!params.q && !params.tag && (
            <Button asChild>
              <Link href="/knihovna/nova">Přidat první knihu</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
          <Suspense>
            <LoadMoreBooks
              initialPage={1}
              searchParams={{ q: params.q, tag: params.tag }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
