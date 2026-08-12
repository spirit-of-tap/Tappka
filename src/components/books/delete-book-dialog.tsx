'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/responsive-alert-dialog';
import { useBookSearch } from './use-book-search';
import { ListStatusBadge } from './book-status-badges';
import { cn } from '@/lib/utils';
import type { BookWithProfiles } from '@/lib/books/types';

interface DeleteBookDialogProps {
  book: BookWithProfiles;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the id of the book that was deleted so the list can be refreshed. */
  onDeleted: (bookId: string) => void;
}

export function DeleteBookDialog({ book, open, onOpenChange, onDeleted }: DeleteBookDialogProps) {
  const [essayCount, setEssayCount] = useState<number | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const { query, results, searching, search, reset: resetSearch } = useBookSearch({ excludeIds: [book.id] });
  const [selected, setSelected] = useState<BookWithProfiles | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEssayCount(null);
    setRerouting(false);
    resetSearch();
    setSelected(null);
    setDeleting(false);
    setError(null);

    fetch(`/api/books/${book.id}/essays-count`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setEssayCount(json?.data?.count ?? 0))
      .catch(() => setEssayCount(0));
    // resetSearch is a fresh closure each render but only clears local state — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, book.id]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          selected ? { reroute_to_book_id: selected.id } : {},
        ),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? 'Nepodařilo se smazat knihu');
        setDeleting(false);
        return;
      }
      toast.success(
        selected
          ? `Eseje přesměrovány na „${selected.title_cs}" a kniha smazána.`
          : 'Kniha smazána.',
      );
      onDeleted(book.id);
      onOpenChange(false);
    } catch {
      setError('Nepodařilo se připojit k serveru');
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Smazat knihu?</AlertDialogTitle>
          <AlertDialogDescription>
            Tato akce trvale smaže <strong>{book.title_cs}</strong> ({book.author}) z knihovny.
            Tuto akci nelze vrátit zpět.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {essayCount === null ? (
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Kontroluji navázané eseje…
          </div>
        ) : essayCount > 0 ? (
          <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">
              K této knize je navázáno <strong>{essayCount}</strong>{' '}
              {essayCount === 1 ? 'esej, která ztratí zdroj' : essayCount < 5 ? 'eseje, které ztratí zdroj' : 'esejí, které ztratí zdroj'}.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRerouting((v) => !v)}
                className="gap-2"
              >
                <ArrowRightLeft className="size-3.5" />
                {rerouting ? 'Zrušit přesměrování' : 'Najít originální knihu a přesměrovat eseje'}
              </Button>
            </div>
            {rerouting && (
              <div className="space-y-2 pt-1">
                <Label htmlFor="reroute-search">Přesměrovat eseje na:</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="reroute-search"
                    value={query}
                    onChange={(e) => void search(e.target.value)}
                    placeholder="Hledat originální knihu…"
                    className="pl-8"
                  />
                </div>
                {searching && <Spinner className="size-4" />}
                {results.length > 0 && (
                  <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
                    {results.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(r)}
                          className={cn(
                            'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted',
                            selected?.id === r.id && 'bg-muted',
                          )}
                        >
                          <span className="font-medium">{r.title_cs}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {r.author}
                            <ListStatusBadge status={r.list_status} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searching && results.length === 0 && query.trim().length >= 2 && (
                  <p className="text-xs text-muted-foreground">Žádné knihy nenalezeny.</p>
                )}
                {selected && (
                  <p className="text-xs text-muted-foreground">
                    Eseje budou přesměrovány na <strong>{selected.title_cs}</strong> a tato kniha smazána.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="px-1 text-sm text-muted-foreground">
            K této knize nejsou navázány žádné eseje.
          </p>
        )}

        {error && <p className="px-1 text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
            disabled={deleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleting ? <Spinner className="size-4 mr-2" /> : <Trash2 className="size-4 mr-2" />}
            Smazat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
