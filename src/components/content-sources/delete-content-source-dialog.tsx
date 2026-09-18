'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, BookOpen, Radio, Search, Trash2 } from 'lucide-react';
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
import { ListStatusBadge } from '@/components/books/book-status-badges';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import { cn } from '@/lib/utils';
import type { BookWithProfiles } from '@/lib/books/types';
import type { ContentSourceWithProfiles } from '@/lib/content-sources/types';

interface DeleteContentSourceDialogProps {
  source: ContentSourceWithProfiles;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the id of the source that was deleted so the list can be refreshed. */
  onDeleted: (sourceId: string) => void;
  /**
   * When 'duplicate', defaults to rerouting search immediately to merge
   * essays into the original record and remove the duplicate.
   */
  mode?: 'delete' | 'duplicate';
}

type RerouteTarget =
  | { kind: 'book'; book: BookWithProfiles }
  | { kind: 'source'; source: ContentSourceWithProfiles };

export function DeleteContentSourceDialog({
  source,
  open,
  onOpenChange,
  onDeleted,
  mode = 'delete',
}: DeleteContentSourceDialogProps) {
  const isDuplicateMode = mode === 'duplicate';
  const [essayCount, setEssayCount] = useState<number | null>(null);
  const [rerouting, setRerouting] = useState(isDuplicateMode);
  const [query, setQuery] = useState('');
  const [bookResults, setBookResults] = useState<BookWithProfiles[]>([]);
  const [sourceResults, setSourceResults] = useState<ContentSourceWithProfiles[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<RerouteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEssayCount(null);
    setRerouting(isDuplicateMode);
    setQuery('');
    setBookResults([]);
    setSourceResults([]);
    setSelected(null);
    setDeleting(false);
    setError(null);

    fetch(`/api/content-sources/${source.id}/essays-count`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setEssayCount(json?.data?.count ?? 0))
      .catch(() => setEssayCount(0));
  }, [open, source.id, isDuplicateMode]);

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setBookResults([]);
      setSourceResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/essays/source-search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      setBookResults(json.data?.books ?? []);
      setSourceResults((json.data?.sources ?? []).filter(
        (s: ContentSourceWithProfiles) => s.id !== source.id,
      ));
    } catch {
      setBookResults([]);
      setSourceResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/content-sources/${source.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          selected
            ? selected.kind === 'book'
              ? { reroute_to_book_id: selected.book.id }
              : { reroute_to_content_source_id: selected.source.id }
            : {},
        ),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? 'Nepodařilo se smazat zdroj');
        setDeleting(false);
        return;
      }
      const targetTitle = selected
        ? selected.kind === 'book'
          ? selected.book.title_cs
          : selected.source.title
        : null;
      toast.success(
        targetTitle
          ? (essayCount && essayCount > 0
              ? `Eseje přesměrovány na „${targetTitle}“ a duplikát smazán.`
              : `Zdroj smazán jako duplikát „${targetTitle}“.`)
          : 'Zdroj smazán.',
      );
      onDeleted(source.id);
      onOpenChange(false);
    } catch {
      setError('Nepodařilo se připojit k serveru');
      setDeleting(false);
    }
  };

  const isConfirmDisabled = deleting || (isDuplicateMode && !selected);
  const hasResults = bookResults.length > 0 || sourceResults.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDuplicateMode ? 'Označit zdroj jako duplikát' : 'Smazat zdroj?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDuplicateMode ? (
              <>
                Zdroj <strong>{source.title}</strong>
                {source.creator ? ` (${source.creator})` : ''} bude smazán a jeho případné eseje budou převedeny na vybraný originál — knihu, nebo jiný zdroj.
              </>
            ) : (
              <>
                Tato akce trvale smaže <strong>{source.title}</strong>
                {source.creator ? ` (${source.creator})` : ''} z knihovny. Tuto akci nelze vrátit zpět.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {essayCount === null ? (
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Kontroluji navázané eseje…
          </div>
        ) : (
          <div className="space-y-3">
            {essayCount > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm text-destructive font-medium">
                  K tomuto zdroji je navázáno <strong>{essayCount}</strong>{' '}
                  {essayCount === 1
                    ? 'esej, která ztratí zdroj'
                    : essayCount < 5
                    ? 'eseje, které ztratí zdroj'
                    : 'esejí, které ztratí zdroj'}.
                </p>
                {!isDuplicateMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRerouting((v) => !v)}
                    className="gap-2"
                  >
                    <ArrowRightLeft className="size-3.5" />
                    {rerouting ? 'Zrušit přesměrování' : 'Najít originál a přesměrovat eseje'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
                <p>K tomuto zdroji nejsou navázány žádné eseje.</p>
                {!isDuplicateMode && !rerouting && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setRerouting(true)}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowRightLeft className="size-3.5" />
                    Označit jako duplikát
                  </Button>
                )}
              </div>
            )}

            {rerouting && (
              <div className="space-y-2 rounded-md border p-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="reroute-search" className="text-xs font-semibold">
                    Vyberte originál (knihu, nebo jiný zdroj):
                  </Label>
                  {!isDuplicateMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setRerouting(false);
                        setSelected(null);
                      }}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Zrušit výběr originálu
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    id="reroute-search"
                    value={query}
                    onChange={(e) => void search(e.target.value)}
                    placeholder="Hledat knihu, podcast, konferenci…"
                    className="pl-8"
                    autoFocus={isDuplicateMode}
                  />
                </div>
                {searching && <Spinner className="size-4" />}
                {hasResults && (
                  <ul className="max-h-48 divide-y overflow-y-auto rounded-md border bg-background">
                    {bookResults.map((r) => (
                      <li key={`book-${r.id}`}>
                        <button
                          type="button"
                          onClick={() => setSelected({ kind: 'book', book: r })}
                          className={cn(
                            'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                            selected?.kind === 'book' && selected.book.id === r.id && 'bg-primary/10 hover:bg-primary/15',
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <BookOpen className="size-3.5 shrink-0 text-muted-foreground" />
                            {r.title_cs}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {r.author}
                            <ListStatusBadge status={r.list_status} />
                          </span>
                        </button>
                      </li>
                    ))}
                    {sourceResults.map((s) => (
                      <li key={`source-${s.id}`}>
                        <button
                          type="button"
                          onClick={() => setSelected({ kind: 'source', source: s })}
                          className={cn(
                            'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                            selected?.kind === 'source' && selected.source.id === s.id && 'bg-primary/10 hover:bg-primary/15',
                          )}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <Radio className="size-3.5 shrink-0 text-muted-foreground" />
                            {s.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {CONTENT_SOURCE_KIND_LABELS[s.kind]}
                            {s.creator ? ` · ${s.creator}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searching && !hasResults && query.trim().length >= 2 && (
                  <p className="text-xs text-muted-foreground">Nic jsme nenašli.</p>
                )}
                {selected && (
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs">
                    Eseje budou přesměrovány na{' '}
                    <strong>
                      {selected.kind === 'book' ? selected.book.title_cs : selected.source.title}
                    </strong>{' '}
                    ({selected.kind === 'book' ? selected.book.author : (selected.source.creator ?? CONTENT_SOURCE_KIND_LABELS[selected.source.kind])}) a tento duplikát bude smazán.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="px-1 text-sm text-destructive">{error}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
            disabled={isConfirmDisabled}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleting ? (
              <Spinner className="size-4 mr-2" />
            ) : selected ? (
              <ArrowRightLeft className="size-4 mr-2" />
            ) : (
              <Trash2 className="size-4 mr-2" />
            )}
            {selected
              ? 'Sloučit a smazat duplikát'
              : isDuplicateMode
              ? 'Vyberte originál'
              : 'Smazat'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
