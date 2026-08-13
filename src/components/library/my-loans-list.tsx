'use client';

import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays } from 'lucide-react';

import { Spinner } from '@/components/ui/spinner';
import { ReturnButton } from './return-button';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import type { BookListStatus, HighlightCategory } from '@/lib/books/types';

interface LoanBook {
  id: string;
  title_cs: string;
  author: string;
  list_status: BookListStatus;
  is_rocket_model: boolean;
  highlight_category: HighlightCategory | null;
}

interface LoanLibraryBook {
  id: string;
  book_id: string;
  book: LoanBook;
}

interface Loan {
  id: string;
  library_book_id: string;
  borrower_id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  library_book: LoanLibraryBook;
}

export function MyLoansList() {
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/library/loans/my');
      const { data } = await res.json();
      setLoans(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!loans || loans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <BookOpen className="size-8" />
        <p className="text-sm">Nemáš žádné výpůjčky</p>
      </div>
    );
  }

  const activeLoans = loans.filter((l) => !l.returned_at);
  const returnedLoans = loans.filter((l) => l.returned_at);

  return (
    <div className="flex flex-col gap-6">
      {activeLoans.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Aktuální výpůjčky</h3>
          <div className="flex flex-col gap-2">
            {activeLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm leading-snug truncate">
                      {loan.library_book.book.title_cs}
                    </p>
                    <BookStatusBadges book={loan.library_book.book} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {loan.library_book.book.author}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      Půjčeno: {formatDate(loan.borrowed_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      Do: {formatDate(loan.due_at)}
                    </span>
                  </div>
                </div>
                <ReturnButton bookId={loan.library_book.book_id} onReturned={fetchLoans} />
              </div>
            ))}
          </div>
        </section>
      )}

      {returnedLoans.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Historie výpůjček</h3>
          <div className="flex flex-col gap-2">
            {returnedLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card opacity-60"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm leading-snug truncate">
                      {loan.library_book.book.title_cs}
                    </p>
                    <BookStatusBadges book={loan.library_book.book} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {loan.library_book.book.author}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      Půjčeno: {formatDate(loan.borrowed_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      Vráceno: {formatDate(loan.returned_at!)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
