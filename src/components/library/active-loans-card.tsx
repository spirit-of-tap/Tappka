'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, BookMarked, CalendarDays, History, AlertTriangle } from 'lucide-react';

import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { ReturnButton } from './return-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/responsive-dialog';
import type { BookLoanWithDetails } from '@/lib/library/types';
import { cn } from '@/lib/utils';

interface ActiveLoansCardProps {
  loans: BookLoanWithDetails[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDueInfo(dueAtStr: string) {
  const due = new Date(dueAtStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const diffMs = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      isOverdue: true,
      tone: 'destructive' as const,
      label: `Po termínu vrácení (${formatDate(dueAtStr)})`,
      badge: 'Po termínu',
    };
  }
  if (diffDays === 0) {
    return {
      isOverdue: false,
      tone: 'warning' as const,
      label: 'Vrátit dnes',
      badge: 'Dnes',
    };
  }
  if (diffDays === 1) {
    return {
      isOverdue: false,
      tone: 'warning' as const,
      label: 'Vrátit zítra',
      badge: 'Zítra',
    };
  }
  if (diffDays <= 4) {
    return {
      isOverdue: false,
      tone: 'warning' as const,
      label: `Vrátit do ${formatDate(dueAtStr)}`,
      badge: `Zbývají ${diffDays} dny`,
    };
  }
  return {
    isOverdue: false,
    tone: 'neutral' as const,
    label: `Vrátit do ${formatDate(dueAtStr)}`,
    badge: null,
  };
}

export function ActiveLoansCard({ loans }: ActiveLoansCardProps) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeLoans = loans.filter((l) => !l.returned_at);
  const returnedLoans = loans.filter((l) => l.returned_at);

  const handleReturned = () => {
    router.refresh();
  };

  if (activeLoans.length === 0 && returnedLoans.length === 0) {
    return null;
  }

  const HistoryDialog = (
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Historie výpůjček</DialogTitle>
          <DialogDescription>
            Knihy, které jsi v minulosti vrátil:a do TAP Knihovny.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto space-y-2 divide-y divide-border/40">
          {returnedLoans.map((loan) => (
            <div key={loan.id} className="pt-2 first:pt-0 flex items-start gap-3">
              <div className="size-8 rounded overflow-hidden bg-muted shrink-0 flex items-center justify-center mt-0.5">
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
                  className="font-medium text-sm hover:text-primary transition-colors line-clamp-1"
                >
                  {loan.library_book.book.title_cs}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {loan.library_book.book.author}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  Vráceno: {formatDate(loan.returned_at!)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-3">
      {activeLoans.map((loan) => {
        const book = loan.library_book.book;
        const dueInfo = getDueInfo(loan.due_at);

        return (
          <div
            key={loan.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border bg-card p-3.5 sm:p-4 transition-colors"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              <Link
                href={`/cteni/knihy/${book.id}`}
                className="shrink-0 w-11 h-15 rounded-md overflow-hidden bg-muted flex items-center justify-center focus-ring mt-0.5 border border-border/40"
              >
                {book.google_books_cover_url ? (
                  <StorageImage
                    storageKey={book.google_books_cover_url}
                    alt={book.title_cs}
                    width={44}
                    height={60}
                    className="size-full object-cover"
                  />
                ) : (
                  <BookOpen className="size-5 text-muted-foreground/40" />
                )}
              </Link>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    <BookMarked className="size-3" />
                    Půjčeno
                  </span>
                  <span className="text-muted-foreground/30">·</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs',
                      dueInfo.tone === 'destructive' && 'text-destructive font-semibold',
                      dueInfo.tone === 'warning' && 'text-warning-strong font-medium',
                      dueInfo.tone === 'neutral' && 'text-muted-foreground',
                    )}
                  >
                    {dueInfo.tone === 'destructive' ? (
                      <AlertTriangle className="size-3" />
                    ) : (
                      <CalendarDays className="size-3" />
                    )}
                    {dueInfo.label}
                  </span>
                  {dueInfo.badge && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.2 text-[10px] font-semibold',
                        dueInfo.tone === 'destructive' &&
                          'bg-destructive/10 text-destructive',
                        dueInfo.tone === 'warning' &&
                          'bg-warning/15 text-warning-strong',
                      )}
                    >
                      {dueInfo.badge}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/cteni/knihy/${book.id}`}
                    className="font-semibold text-sm hover:text-primary transition-colors truncate focus-ring"
                  >
                    {book.title_cs}
                  </Link>
                  <BookStatusBadges book={book} />
                </div>

                <p className="text-xs text-muted-foreground truncate">{book.author}</p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
              {returnedLoans.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-ring rounded-sm transition-colors"
                >
                  <History className="size-3.5" />
                  Historie ({returnedLoans.length})
                </button>
              )}
              <ReturnButton
                bookId={loan.library_book.book_id}
                onReturned={handleReturned}
                size="sm"
              />
            </div>
          </div>
        );
      })}

      {/* When there are no active loans but past returned loans exist */}
      {activeLoans.length === 0 && returnedLoans.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-ring rounded-sm transition-colors py-1"
          >
            <History className="size-3.5" />
            Historie výpůjček ({returnedLoans.length})
          </button>
        </div>
      )}

      {HistoryDialog}
    </div>
  );
}
