'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BarcodeScanner } from 'react-barcode-scanner';
import 'react-barcode-scanner/polyfill';
import { BookOpen, Camera, ChevronRight, Library, Plus, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';
import { looksLikeIsbn } from '@/lib/books/external';
import type { ExternalBookCandidate } from '@/lib/books/types';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

interface CatalogueHit {
  id: string;
  title_cs: string;
  author: string;
  google_books_cover_url?: string | null;
}

interface StepSearchProps {
  initialQuery: string;
  onSelect: (candidate: ExternalBookCandidate) => void;
  onManual: (title: string, author: string) => void;
}

export function StepSearch({ initialQuery, onSelect, onManual }: StepSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [catalogue, setCatalogue] = useState<CatalogueHit[]>([]);
  const [external, setExternal] = useState<ExternalBookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showDespiteDuplicate, setShowDespiteDuplicate] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setCatalogue([]);
      setExternal([]);
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = encodeURIComponent(query.trim());

        if (looksLikeIsbn(query)) {
          // An ISBN identifies an edition: the record in BOB may carry a
          // different ISBN (translation, reprint). Resolve the work through
          // the external provider first, then look the title up in the
          // catalogue so the duplicate gate fires for the same book.
          const externalRes = await fetch(`/api/books/external-search?q=${q}`);
          const externalJson = await externalRes.json();
          const hits = (externalJson.data ?? []) as ExternalBookCandidate[];
          setExternal(hits);

          const probeTitle = hits[0]?.title;
          if (probeTitle) {
            const localRes = await fetch(
              `/api/books/search?q=${encodeURIComponent(probeTitle)}`,
            );
            const localJson = await localRes.json();
            setCatalogue(localJson.data ?? []);
          } else {
            setCatalogue([]);
          }
        } else {
          const [localRes, externalRes] = await Promise.all([
            fetch(`/api/books/search?q=${q}`),
            fetch(`/api/books/external-search?q=${q}`),
          ]);
          const [localJson, externalJson] = await Promise.all([localRes.json(), externalRes.json()]);
          setCatalogue(localJson.data ?? []);
          setExternal(externalJson.data ?? []);
        }
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  // A new query is a new question — the duplicate warning must not stay dismissed.
  useEffect(() => {
    setShowDespiteDuplicate(false);
  }, [query]);

  const manualReady = manualTitle.trim().length > 0 && manualAuthor.trim().length > 0;
  const hasDuplicate = catalogue.length > 0;
  const externalVisible = external.length > 0 && (!hasDuplicate || showDespiteDuplicate);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="book-search">Najdi knihu</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            id="book-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Název knihy nebo jméno autora…"
            className="h-11 pr-20 pl-9"
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
            {searching && <Spinner className="size-4" />}
            {/* Scanning is another way to type the query, so it belongs in the field. */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={showScanner ? 'Zavřít skener' : 'Naskenovat ISBN'}
              onClick={() => setShowScanner((open) => !open)}
            >
              {showScanner ? <X className="size-4" /> : <Camera className="size-4" />}
            </Button>
          </div>
        </div>
      </div>

      {showScanner && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <BarcodeScanner
            options={{ delay: 500, formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }}
            paused={false}
            onCapture={(barcodes) => {
              const code = barcodes[0]?.rawValue;
              if (code) {
                setShowScanner(false);
                setQuery(code);
              }
            }}
          />
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
            Namiř kameru na čárový kód ISBN
          </p>
        </div>
      )}

      {hasDuplicate && (
        <section className="space-y-3 rounded-xl border border-info bg-info/10 p-4">
          {/* `--info-foreground` is white — it is the colour for text *on* an info
              fill, not on a 10% tint. The border and tint carry the notice; the
              icon just has to stay legible in both themes. */}
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Library className="size-4 shrink-0" />
            Tuhle knihu už v BOBovi máme
          </h3>
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {catalogue.map((book) => (
              <Link
                key={book.id}
                href={`/cteni/knihy/${book.id}`}
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {book.google_books_cover_url ? (
                    <StorageImage
                      storageKey={book.google_books_cover_url}
                      alt={book.title_cs}
                      width={32}
                      height={44}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <BookOpen className="size-3.5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{book.title_cs}</p>
                  <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
          {external.length > 0 && !showDespiteDuplicate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDespiteDuplicate(true)}
            >
              Přesto přidat jinou verzi
            </Button>
          )}
        </section>
      )}

      {externalVisible && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Mimo katalog
          </h3>
          <div className="space-y-2">
            {external.map((candidate) => (
              <button
                key={`${candidate.source}-${candidate.external_id}`}
                type="button"
                onClick={() => onSelect(candidate)}
                className="focus-ring flex w-full gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                  {candidate.cover_url ? (
                    // Remote cover, not yet in storage — plain img is correct here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={candidate.cover_url}
                      alt={candidate.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <BookOpen className="size-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">{candidate.title}</p>
                  <p className="text-xs text-muted-foreground">{candidate.author}</p>
                  <p className="text-xs text-muted-foreground/80">
                    {[
                      candidate.published_year,
                      candidate.publisher,
                      candidate.page_count ? `${candidate.page_count} s.` : null,
                      candidate.isbn_13 ? `ISBN ${candidate.isbn_13}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      )}

      {!manualOpen ? (
        <Button variant="outline" className="gap-2" onClick={() => setManualOpen(true)}>
          <Plus className="size-4" />
          Nemůžeš ji najít? Zadat ručně
        </Button>
      ) : (
        <section className="space-y-3 rounded-xl border bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">Doplníme, co půjde.</p>
          <div className="space-y-1">
            <Label htmlFor="manual-title">Název</Label>
            <Input
              id="manual-title"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="manual-author">Autor</Label>
            <Input
              id="manual-author"
              value={manualAuthor}
              onChange={(e) => setManualAuthor(e.target.value)}
            />
          </div>
          <Button
            disabled={!manualReady}
            onClick={() => onManual(manualTitle.trim(), manualAuthor.trim())}
          >
            Pokračovat
          </Button>
        </section>
      )}
    </div>
  );
}
