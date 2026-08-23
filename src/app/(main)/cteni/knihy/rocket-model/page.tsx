import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getRocketModelBooks } from '@/lib/books/queries';
import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { PageBack } from '@/components/ui/page-back';
import { PageHeader } from '@/components/ui/page-header';
import { PageShell } from '@/components/ui/page-shell';
import { formatPointsWithLabel } from '@/lib/books/points';
import { pluralizeCz } from '@/lib/utils/pluralize-cz';

export const metadata = {
  title: 'Rocket Model | Tappka',
  description: 'Klíčové knihy programu — pomáhají Téčkům nastartovat cestu rychleji a bez oklik',
};

export default async function RocketModelPage() {
  const supabase = await createClient();
  const books = await getRocketModelBooks(supabase);

  return (
    <PageShell size="wide" className="space-y-8">
      <PageBack href="/cteni/hledat" label="Zpět do hledání" />

      <PageHeader
        title="Rocket Model"
        description="Klíčové knihy programu — pomáhají Téčkům nastartovat cestu rychleji a bez oklik"
        count={{ value: books.length, label: pluralizeCz(books.length, ['kniha', 'knihy', 'knih']) }}
      />

      {books.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Zatím žádné knihy v Rocket Modelu.</div>
      ) : (
        <div className="divide-y rounded-xl border overflow-hidden bg-card">
          {books.map((book) => (
            <div key={book.id} className="group flex gap-3 px-3 py-3">
              <Link
                href={`/cteni/knihy/${book.id}`}
                className="mt-0.5 flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
              >
                {book.google_books_cover_url ? (
                  <StorageImage
                    storageKey={book.google_books_cover_url}
                    alt={book.title_cs}
                    width={44}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookOpen className="size-4 text-muted-foreground/30" />
                )}
              </Link>
              <div className="min-w-0 flex-1 space-y-1 py-0.5">
                <Link href={`/cteni/knihy/${book.id}`} className="flex items-center gap-1.5">
                  <p className="line-clamp-1 text-sm font-medium leading-snug transition-colors group-hover:text-primary">
                    {book.title_cs}
                  </p>
                  <BookStatusBadges book={book} />
                </Link>
                {book.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{book.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{formatPointsWithLabel(book.book_points)}</span>
                  {book.essay_count > 0 && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-muted-foreground">{book.essay_count} esejí</span>
                    </>
                  )}
                  {book.preview_link && (
                    <a
                      href={book.preview_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-0.5 text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      Náhled
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
