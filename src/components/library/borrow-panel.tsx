'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookMarked, BookOpen, Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Confetti } from '@/components/ui/confetti';
import { StorageImage } from '@/components/storage/storage-image';
import { BookStatusBadges } from '@/components/books/book-status-badges';
import { ReturnButton } from './return-button';
import type { BookWithProfiles } from '@/lib/books/types';
import { formatLibraryLabelCode } from '@/lib/library/label-code';

interface BorrowPanelProps {
  bookId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  availableCopies: number;
  totalCopies: number;
  labelCode?: number | null;
  initialDueAt?: string | null;
  /** Status fields for the badge row next to the title — omit to hide badges. */
  book?: Pick<BookWithProfiles, 'list_status' | 'is_rocket_model' | 'highlight_category'>;
}

function formatDueDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function BorrowPanel({
  bookId,
  title,
  author,
  coverUrl,
  availableCopies,
  totalCopies,
  labelCode = null,
  initialDueAt = null,
  book,
}: BorrowPanelProps) {
  const [borrowing, setBorrowing] = useState(false);
  const [dueAt, setDueAt] = useState(initialDueAt);
  const [justBorrowed, setJustBorrowed] = useState(false);

  const handleBorrow = async () => {
    setBorrowing(true);
    try {
      const labelQuery = labelCode == null ? '' : `?label=${labelCode}`;
      const res = await fetch(`/api/library/books/${bookId}/borrow${labelQuery}`, { method: 'POST' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? 'Nepodařilo se vypůjčit knihu');
      setDueAt(body.data.due_at);
      setJustBorrowed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nepodařilo se vypůjčit knihu');
    } finally {
      setBorrowing(false);
    }
  };

  const handleReturned = () => {
    setDueAt(null);
    setJustBorrowed(false);
  };

  if (dueAt) {
    return (
      <div className="relative flex flex-col items-center gap-4 py-10 text-center">
        {justBorrowed && (
          <>
            <Confetti
              className="pointer-events-none fixed inset-0 z-50 h-full w-full"
              options={{
                particleCount: 120,
                spread: 90,
                origin: { y: 0.5 },
                colors: ['#b31b1b', '#2c1a1d', '#FBFFF5'],
              }}
            />
            <div className="borrow-check-pop flex size-16 items-center justify-center rounded-full bg-success/10 text-success-strong">
              <Check className="size-8" strokeWidth={2.5} />
            </div>
          </>
        )}
        <div className="borrow-fade-up space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {justBorrowed ? 'Kniha vypůjčena!' : 'Tuto knihu už máš vypůjčenou'}
          </h1>
          <div className="flex items-center justify-center gap-1.5">
            <p className="text-muted-foreground">{title}</p>
            {book && <BookStatusBadges book={book} />}
          </div>
        </div>
        <div className="borrow-fade-up rounded-xl bg-muted px-6 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vrať do</p>
          <p className="text-xl font-bold text-foreground">{formatDueDate(dueAt)}</p>
        </div>
        {justBorrowed && (
          <p className="borrow-fade-up text-sm text-muted-foreground">Podrobnosti jsme ti poslali e-mailem.</p>
        )}
        <div className="borrow-fade-up flex flex-col items-center gap-2">
          <ReturnButton bookId={bookId} onReturned={handleReturned} />
          <Link href="/cteni/prehled?tab=vypujcky" className="text-sm font-medium text-primary hover:underline">
            Moje výpůjčky
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="flex aspect-[2/3] w-40 items-center justify-center overflow-hidden rounded-xl bg-muted shadow-lg ring-1 ring-border/50">
        {coverUrl ? (
          <StorageImage
            storageKey={coverUrl}
            alt={title}
            className="h-full w-full object-cover"
            width={160}
            height={240}
          />
        ) : (
          <BookOpen className="size-12 text-muted-foreground/60" />
        )}
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {book && (
          <div className="flex items-center justify-center">
            <BookStatusBadges book={book} />
          </div>
        )}
        <p className="text-muted-foreground">{author}</p>
        {labelCode != null && (
          <p className="text-sm font-medium text-primary">Výtisk {formatLibraryLabelCode(labelCode)}</p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {labelCode != null
          ? (availableCopies > 0 ? 'Tento výtisk je k dispozici.' : 'Tento výtisk je momentálně půjčený.')
          : availableCopies > 0
          ? `${availableCopies} z ${totalCopies} kopií je teď k dispozici.`
          : `Všech ${totalCopies} kopií je momentálně půjčeno.`}
      </p>

      <Button onClick={handleBorrow} disabled={availableCopies === 0 || borrowing} size="lg" className="gap-2">
        {borrowing ? <Spinner className="size-4" /> : <BookMarked className="size-4" />}
        Půjčit si
      </Button>
    </div>
  );
}
