'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, BookOpen, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { CategoryPicker } from './category-picker';
import type { ExternalBookCandidate, Book } from '@/lib/books/types';

type Step = 'local-search' | 'external-search' | 'manual';

export function AddBookWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('local-search');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [localResults, setLocalResults] = useState<Book[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalBookCandidate[]>([]);
  const [selectedPoints, setSelectedPoints] = useState<1 | 2 | 3>(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState({ title: '', author: '', isbn_13: '', description: '' });

  const searchLocal = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(query)}`);
      const { data } = await res.json();
      setLocalResults(data ?? []);
    } finally {
      setIsSearching(false);
    }
  };

  const searchExternal = async () => {
    setIsSearching(true);
    setStep('external-search');
    try {
      const res = await fetch(`/api/books/external-search?q=${encodeURIComponent(query)}`);
      const { data } = await res.json();
      setExternalResults(data ?? []);
    } finally {
      setIsSearching(false);
    }
  };

  const submitBook = async (candidate: Partial<ExternalBookCandidate> & { title: string; author: string }) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: candidate.title,
          author: candidate.author,
          isbn_13: candidate.isbn_13,
          description: candidate.description,
          cover_url: candidate.cover_url,
          source: candidate.source ?? 'manual',
          external_id: 'external_id' in candidate ? candidate.external_id : undefined,
          suggested_points: selectedPoints,
          tags: selectedTags,
        }),
      });
      const json = await res.json();
      if (res.status === 409 && json.existingId) {
        router.push(`/knihovna/${json.existingId}`);
        return;
      }
      if (json.data?.id) {
        router.push(`/knihovna/${json.data.id}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {step === 'local-search' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Hledej podle názvu nebo autora</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Název knihy nebo jméno autora..."
                onKeyDown={(e) => e.key === 'Enter' && searchLocal()}
              />
              <Button onClick={searchLocal} disabled={isSearching || !query.trim()}>
                {isSearching ? <Spinner className="size-4" /> : <Search className="size-4" />}
              </Button>
            </div>
          </div>

          {localResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Nalezeno v katalogu:</p>
              {localResults.map((book) => (
                <Card key={book.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push(`/knihovna/${book.id}`)}>
                  <CardContent className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.author}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {localResults.length === 0 && query && !isSearching && (
            <p className="text-sm text-muted-foreground">Žádné výsledky v katalogu.</p>
          )}

          <Button variant="outline" onClick={searchExternal} disabled={!query.trim() || isSearching}>
            <Search className="size-4 mr-2" />
            Hledat mimo katalog (Google Books, Open Library)
          </Button>
          <div className="pt-2">
            <Button variant="ghost" onClick={() => setStep('manual')}>
              <Plus className="size-4 mr-2" />
              Zadat ručně
            </Button>
          </div>
        </div>
      )}

      {step === 'external-search' && (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setStep('local-search')}>← Zpět</Button>
          <h2 className="font-semibold">Výsledky z externích zdrojů</h2>
          {isSearching && <Spinner />}
          {!isSearching && externalResults.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Nic nenalezeno. Zkus zadat ručně.</p>
              <Button variant="outline" onClick={() => setStep('manual')}>Zadat ručně</Button>
            </div>
          )}
          {externalResults.map((candidate, i) => {
            const existing = localResults.find((b) =>
              (candidate.isbn_13 && b.isbn_13 === candidate.isbn_13) ||
              (b.title.toLowerCase() === candidate.title.toLowerCase() &&
               b.author.toLowerCase() === candidate.author.toLowerCase())
            );
            return (
              <Card key={i} className={existing ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50 transition-colors'}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{candidate.title}</p>
                      <p className="text-xs text-muted-foreground">{candidate.author}</p>
                      {candidate.isbn_13 && <p className="text-xs text-muted-foreground">ISBN: {candidate.isbn_13}</p>}
                      <Badge variant="outline" className="text-xs mt-1">
                        {candidate.source === 'google_books' ? 'Google Books' : 'Open Library'}
                      </Badge>
                    </div>
                  </div>
                  {existing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Již v katalogu</span>
                      <Button size="sm" variant="outline" onClick={() => router.push(`/knihovna/${existing.id}`)}>
                        Zobrazit
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Kategorie</Label>
                        <CategoryPicker selected={selectedTags} onChange={setSelectedTags} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Bodů:</Label>
                        {([1, 2, 3] as const).map((p) => (
                          <Button
                            key={p}
                            size="sm"
                            variant={selectedPoints === p ? 'default' : 'outline'}
                            onClick={() => setSelectedPoints(p)}
                            className="h-7 w-7 p-0"
                          >
                            {p}
                          </Button>
                        ))}
                        <Button size="sm" onClick={() => submitBook(candidate)} disabled={isSubmitting}>
                          {isSubmitting ? <Spinner className="size-4" /> : 'Přidat'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {step === 'manual' && (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setStep('local-search')}>← Zpět</Button>
          <h2 className="font-semibold">Zadat knihu ručně</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">Název *</Label>
              <Input id="title" value={manualForm.title} onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="author">Autor *</Label>
              <Input id="author" value={manualForm.author} onChange={(e) => setManualForm({ ...manualForm, author: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="isbn">ISBN-13</Label>
              <Input id="isbn" value={manualForm.isbn_13} onChange={(e) => setManualForm({ ...manualForm, isbn_13: e.target.value })} placeholder="9780000000000" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="desc">Popis</Label>
              <Textarea id="desc" value={manualForm.description} onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Kategorie</Label>
              <CategoryPicker selected={selectedTags} onChange={setSelectedTags} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Navrhovaný počet bodů:</Label>
              {([1, 2, 3] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={selectedPoints === p ? 'default' : 'outline'}
                  onClick={() => setSelectedPoints(p)}
                  className="h-7 w-7 p-0"
                >
                  {p}
                </Button>
              ))}
            </div>
            <Button
              onClick={() => submitBook({ ...manualForm, cover_url: null, source: 'manual', external_id: undefined })}
              disabled={!manualForm.title.trim() || !manualForm.author.trim() || isSubmitting}
            >
              {isSubmitting ? <Spinner className="size-4 mr-2" /> : <BookOpen className="size-4 mr-2" />}
              Přidat knihu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
