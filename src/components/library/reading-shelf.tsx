'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, History } from 'lucide-react';

import { StorageImage } from '@/components/storage/storage-image';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { bookToneClass } from '@/lib/essays/book-tone';
import { loanCaption } from '@/lib/library/loan-caption';
import type { BookLoanWithDetails } from '@/lib/library/types';
import { cn } from '@/lib/utils';

import { ReturnButton } from './return-button';

interface ReadingShelfProps {
  loans: BookLoanWithDetails[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function ReadingShelf({ loans }: ReadingShelfProps) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeLoans = loans.filter((l) => !l.returned_at);
  const returnedLoans = loans.filter((l) => l.returned_at);

  return (
    <section aria-labelledby="reading-shelf-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="reading-shelf-heading" className="text-base font-semibold">
          Právě čtu
        </h2>
        {returnedLoans.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setHistoryOpen(true)}
          >
            <History />
            Historie výpůjček ({returnedLoans.length})
          </Button>
        )}
      </div>

      {activeLoans.length === 0 ? (
        <Empty className="border border-dashed p-6 md:p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle>Zrovna nic nečteš</EmptyTitle>
            <EmptyDescription>Vyber si knihu z knihovny a půjč si ji.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/cteni/knihy">Najít knihu</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="flex gap-4 overflow-x-auto rounded-2xl border bg-card p-4 shadow-sm no-scrollbar">
          {activeLoans.map((loan) => {
            const book = loan.library_book.book;
            const caption = loanCaption(loan.due_at);

            return (
              <li key={loan.id} className="w-24 shrink-0 space-y-2">
                <Link
                  href={`/cteni/knihy/${book.id}`}
                  aria-label={book.title_cs}
                  className="group focus-ring block space-y-2 rounded-md"
                >
                  <span className="block aspect-[2/3] overflow-hidden rounded-md border border-border/40 shadow-sm motion-safe:transition-transform motion-safe:group-hover:-translate-y-0.5">
                    {book.google_books_cover_url ? (
                      <StorageImage
                        storageKey={book.google_books_cover_url}
                        alt=""
                        width={96}
                        height={144}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span
                        className={cn(
                          'flex size-full items-end border-l-4 border-primary-foreground/30 p-2 text-left text-xs font-semibold leading-tight',
                          bookToneClass(book.id),
                        )}
                      >
                        <span className="line-clamp-5 break-words">{book.title_cs}</span>
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'block text-xs',
                      caption.isOverdue ? 'font-semibold text-destructive-strong' : 'text-muted-foreground',
                    )}
                  >
                    {caption.label}
                  </span>
                </Link>
                <ReturnButton
                  bookId={loan.library_book.book_id}
                  onReturned={() => router.refresh()}
                  size="sm"
                  className="w-full"
                />
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Historie výpůjček</DialogTitle>
            <DialogDescription>Knihy, které jsi v minulosti vrátil:a do TAP Knihovny.</DialogDescription>
          </DialogHeader>

          <div className="max-h-80 space-y-2 divide-y divide-border/40 overflow-y-auto">
            {returnedLoans.map((loan) => (
              <div key={loan.id} className="flex items-start gap-3 pt-2 first:pt-0">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {loan.library_book.book.google_books_cover_url ? (
                    <StorageImage
                      storageKey={loan.library_book.book.google_books_cover_url}
                      alt={loan.library_book.book.title_cs}
                      width={32}
                      height={44}
                      className="size-full object-cover"
                    />
                  ) : (
                    <BookOpen className="size-4 text-muted-foreground/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/cteni/knihy/${loan.library_book.book_id}`}
                    className="line-clamp-1 text-sm font-medium transition-colors hover:text-primary"
                  >
                    {loan.library_book.book.title_cs}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{loan.library_book.book.author}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Vráceno: {formatDate(loan.returned_at!)}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
