'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';
import type { BookWithProfiles, ExternalBookCandidate } from '@/lib/books/types';

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;

interface ReplaceRecordFlowProps {
  book: BookWithProfiles;
  /** Back to the edit form; nothing has been saved yet. */
  onBack: () => void;
  /** Called with the refreshed book after a successful replacement. */
  onReplaced: (book: BookWithProfiles) => void;
}

type Step = 'search' | 'confirm';

export function ReplaceRecordFlow({ book, onBack, onReplaced }: ReplaceRecordFlowProps) {
  const [step, setStep] = useState<Step>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExternalBookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<ExternalBookCandidate | null>(null);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearchError(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/books/external-search?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        if (!res.ok) {
          setSearchError(json.error ?? 'Externí hledání selhalo');
          setResults([]);
          return;
        }
        setResults((json.data ?? []) as ExternalBookCandidate[]);
      } catch {
        setSearchError('Externí hledání selhalo');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const handleConfirm = async () => {
    if (!candidate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'replace-record',
          cover_url: candidate.cover_url,
          isbn_13: candidate.isbn_13,
          external_id: candidate.external_id,
          source: candidate.source,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? 'Nepodařilo se nahradit záznam');
        return;
      }
      toast.success('Záznam knihy byl nahrazen');
      onReplaced(json.data);
    } catch {
      toast.error('Nepodařilo se nahradit záznam');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'confirm' && candidate) {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold">Potvrdit náhradu</h3>
          <p className="text-sm text-muted-foreground">
            Obálka, ISBN a identifikátor záznamu (zdroj) budou v databázi přepsány.
            Název a autor zůstanou beze změny.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Současný záznam</p>
            <CoverOrMissing url={book.google_books_cover_url} />
            <p className="text-sm font-medium">{book.title_cs}</p>
            <p className="text-sm text-muted-foreground">{book.isbn_13 ?? 'bez ISBN'}</p>
            <p className="text-xs text-muted-foreground">Zdroj: {book.source} · {book.external_id ?? 'bez ID'}</p>
          </div>
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nový záznam</p>
            <CoverOrMissing url={candidate.cover_url} />
            <p className="text-sm font-medium">{candidate.title}</p>
            <p className="text-sm text-muted-foreground">{candidate.isbn_13 ?? 'bez ISBN'}</p>
            <p className="text-xs text-muted-foreground">Zdroj: {candidate.source} · {candidate.external_id}</p>
          </div>
        </div>

        {saving ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Ukládám…
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button onClick={handleConfirm} disabled={saving} className="gap-2">
              <Check className="size-4" />
              Potvrdit náhradu
            </Button>
            <Button variant="ghost" onClick={() => { setCandidate(null); setStep('search'); }} disabled={saving} className="gap-2">
              <ArrowLeft className="size-4" />
              Zpět
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold">Nahradit záznam</h3>
        <p className="text-sm text-muted-foreground">
          Najdi správnou verzi knihy. Obálka a ISBN se přepíšou v databázi.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="replace-query">Hledat</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="replace-query"
            className="pl-8"
            placeholder="Hledat podle názvu, autora nebo ISBN…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {searching && <Spinner className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2" />}
        </div>
      </div>

      {searchError && <p className="text-sm text-destructive">{searchError}</p>}

      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {results.length === 0 && !searching && query.trim().length >= MIN_QUERY_LENGTH && (
          <p className="text-sm text-muted-foreground">Žádné výsledky</p>
        )}
        {results.map((hit) => (
          <button
            key={`${hit.source}:${hit.external_id}`}
            type="button"
            onClick={() => { setCandidate(hit); setStep('confirm'); }}
            className="flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted/50"
          >
            <CoverOrMissing url={hit.cover_url} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{hit.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {hit.author} · {hit.isbn_13 ?? 'bez ISBN'} {hit.published_year ? `· ${hit.published_year}` : ''}
              </p>
            </div>
            <BookOpen className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="size-4" />
        Zpět na úpravy
      </Button>
    </div>
  );
}

function CoverOrMissing({ url, size = 'md' }: { url: string | null; size?: 'sm' | 'md' }) {
  const className = size === 'sm' ? 'h-16 w-12' : 'h-24 w-16';
  if (!url) {
    return (
      <div className={`${className} flex items-center justify-center rounded-sm bg-muted text-muted-foreground`}>
        <BookOpen className="size-5" />
      </div>
    );
  }
  return (
    <StorageImage
      storageKey={url}
      alt=""
      width={size === 'sm' ? 48 : 64}
      height={size === 'sm' ? 64 : 96}
      className={`${className} rounded-sm object-cover`}
    />
  );
}
