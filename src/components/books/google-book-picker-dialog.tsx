'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ExternalLink, Eye, EyeOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { StorageImage } from '@/components/storage/storage-image';
import type { ExternalBookCandidate } from '@/lib/books/types';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

interface GoogleBookPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
  initialIsbn?: string;
  onSelect: (candidate: ExternalBookCandidate) => void;
}

export function GoogleBookPickerDialog({
  open,
  onOpenChange,
  initialQuery = '',
  initialIsbn = '',
  onSelect,
}: GoogleBookPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalBookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryRef = useRef(query);

  useEffect(() => {
    if (!open) return;
    const defaultSearch = initialIsbn.trim() || initialQuery.trim();
    setQuery(defaultSearch);
    queryRef.current = defaultSearch;
    setError(null);
    if (!defaultSearch) {
      setResults([]);
      return;
    }

    setSearching(true);
    const param = initialIsbn.trim()
      ? `isbn=${encodeURIComponent(initialIsbn.trim())}`
      : `q=${encodeURIComponent(defaultSearch)}`;

    fetch(`/api/books/external-search?${param}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Chyba hledání'))))
      .then((json) => {
        setResults((json.data ?? []) as ExternalBookCandidate[]);
      })
      .catch(() => {
        setError('Nepodařilo se vyhledat záznamy');
        setResults([]);
      })
      .finally(() => {
        setSearching(false);
      });
  }, [open, initialQuery, initialIsbn]);

  useEffect(() => {
    queryRef.current = query;
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      setSearching(false);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const q = query.trim();
      if (q !== queryRef.current) return;
      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/books/external-search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (q !== queryRef.current) return;
        if (!res.ok) {
          setError(json.error ?? 'Hledání na Google Books selhalo');
          setResults([]);
          return;
        }
        setResults((json.data ?? []) as ExternalBookCandidate[]);
      } catch {
        if (q !== queryRef.current) return;
        setError('Nepodařilo se připojit k vyhledávání');
        setResults([]);
      } finally {
        if (q === queryRef.current) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col p-6">
        <DialogHeader>
          <DialogTitle>Vybrat záznam z Google Books</DialogTitle>
          <DialogDescription>
            Vyhledej a vyber vydání knihy. Zvolený záznam nastaví obálku a odkaz na náhled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <Label htmlFor="google-search-query">Hledat na Google Books</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="google-search-query"
              className="pl-8"
              placeholder="Název, autor:ka nebo ISBN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {searching && <Spinner className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2" />}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
          {results.length === 0 && !searching && !error && query.trim().length >= MIN_QUERY_LENGTH && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Žádné výsledky na Google Books pro dotaz „{query}“.
            </p>
          )}

          {results.map((candidate) => {
            const hasCover = Boolean(candidate.cover_url);
            const hasPreview = Boolean(candidate.preview_link);

            return (
              <div
                key={`${candidate.source}:${candidate.external_id}`}
                className="group relative flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="shrink-0">
                  <div className="relative aspect-[2/3] w-14 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                    {candidate.cover_url ? (
                      <StorageImage
                        storageKey={candidate.cover_url}
                        alt=""
                        width={56}
                        height={84}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BookOpen className="size-5 text-muted-foreground/50" />
                    )}
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold leading-tight line-clamp-1">
                    {candidate.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {candidate.author}
                    {candidate.published_year ? ` · ${candidate.published_year}` : ''}
                    {candidate.publisher ? ` · ${candidate.publisher}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ISBN: {candidate.isbn_13 ?? 'není uvedeno'}
                    {candidate.page_count ? ` · ${candidate.page_count} stran` : ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {hasCover ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <Check className="size-3" /> Obálka k dispozici
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Bez obálky</span>
                    )}

                    <span className="text-muted-foreground/40">·</span>

                    {hasPreview ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                        <Eye className="size-3" /> Má náhled
                        {candidate.preview_link && (
                          <a
                            href={candidate.preview_link.replace(/^http:\/\//, 'https://')}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="ml-1 inline-flex items-center gap-0.5 hover:underline text-primary"
                          >
                            (otevřít <ExternalLink className="size-2.5" />)
                          </a>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <EyeOff className="size-3" /> Bez náhledu
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 self-center">
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelect(candidate);
                      onOpenChange(false);
                    }}
                    className="gap-1.5"
                  >
                    <Check className="size-3.5" />
                    Vybrat
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
