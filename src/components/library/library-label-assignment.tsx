'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Camera, CheckCircle2, QrCode, RotateCcw, Search, X } from 'lucide-react';
import { BarcodeScanner } from 'react-barcode-scanner';
import { toast } from 'sonner';
import 'react-barcode-scanner/polyfill';

import { StorageImage } from '@/components/storage/storage-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { formatLibraryLabelCode, parseLibraryLabelCode } from '@/lib/library/label-code';

const SCANNER_DELAY_MS = 400;

const LABEL_STATUS = {
  idle: 'idle',
  checking: 'checking',
  unassigned: 'unassigned',
  assigned: 'assigned',
  error: 'error',
} as const;

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BookSearchResult {
  id: string;
  title_cs: string;
  author: string;
  isbn_13?: string | null;
  google_books_cover_url: string | null;
}

interface AssignedCopy {
  id: string;
  book_id: string;
  label_code: number;
  reused_existing_copy?: boolean;
  book: BookSearchResult;
}

interface LibraryLabelAssignmentProps {
  initialLabelCode: number | null;
}

export function LibraryLabelAssignment({ initialLabelCode }: LibraryLabelAssignmentProps) {
  const [labelCode, setLabelCode] = useState<number | null>(initialLabelCode);
  const [manualLabelCode, setManualLabelCode] = useState(initialLabelCode?.toString() ?? '');
  const [labelStatus, setLabelStatus] = useState<keyof typeof LABEL_STATUS>(
    initialLabelCode == null ? LABEL_STATUS.idle : LABEL_STATUS.checking,
  );
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [assignedCopy, setAssignedCopy] = useState<AssignedCopy | null>(null);
  const [justAssigned, setJustAssigned] = useState(false);
  const [showLabelScanner, setShowLabelScanner] = useState(initialLabelCode == null);
  const [showBookScanner, setShowBookScanner] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [assigningBookId, setAssigningBookId] = useState<string | null>(null);

  useEffect(() => {
    if (labelCode == null) return;

    let cancelled = false;
    const checkLabel = async () => {
      setLabelStatus(LABEL_STATUS.checking);
      setAssignedCopy(null);
      setJustAssigned(false);

      try {
        const response = await fetch(`/api/library/labels/${labelCode}`);
        if (cancelled) return;

        if (response.status === 404) {
          setLabelStatus(LABEL_STATUS.unassigned);
          return;
        }

        const body: { data?: AssignedCopy; error?: string } = await response.json();
        if (!response.ok || !body.data) {
          throw new Error(body.error ?? 'Nepodařilo se ověřit štítek');
        }

        setAssignedCopy(body.data);
        setLabelStatus(LABEL_STATUS.assigned);
      } catch (error) {
        if (cancelled) return;
        setLabelStatus(LABEL_STATUS.error);
        toast.error(error instanceof Error ? error.message : 'Nepodařilo se ověřit štítek');
      }
    };

    void checkLabel();
    return () => {
      cancelled = true;
    };
  }, [checkAttempt, labelCode]);

  const acceptLabelValue = useCallback((value: string) => {
    const parsed = parseLibraryLabelCode(value);
    if (parsed == null) {
      toast.error('QR kód neobsahuje platný knihovní štítek');
      return;
    }

    setLabelCode(parsed);
    setManualLabelCode(parsed.toString());
    setShowLabelScanner(false);
    setQuery('');
    setResults(null);
  }, []);

  const handleLabelCapture = useCallback((barcodes: DetectedBarcode[]) => {
    const value = barcodes[0]?.rawValue;
    if (value) acceptLabelValue(value);
  }, [acceptLabelValue]);

  const handleManualLabel = (event: React.FormEvent) => {
    event.preventDefault();
    acceptLabelValue(manualLabelCode);
  };

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const trimmedQuery = (searchQuery ?? query).trim();
    if (!trimmedQuery) return;

    setSearching(true);
    setResults(null);
    try {
      const response = await fetch(`/api/books/search?q=${encodeURIComponent(trimmedQuery)}`);
      const body: { data?: BookSearchResult[]; error?: string } = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Nepodařilo se vyhledat knihy');
      setResults(body.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nepodařilo se vyhledat knihy');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleBookCapture = useCallback((barcodes: DetectedBarcode[]) => {
    const value = barcodes[0]?.rawValue;
    if (!value) return;

    setQuery(value);
    setShowBookScanner(false);
    void handleSearch(value);
  }, [handleSearch]);

  const handleAssign = async (book: BookSearchResult) => {
    if (labelCode == null) return;

    setAssigningBookId(book.id);
    try {
      const response = await fetch(`/api/library/labels/${labelCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: book.id }),
      });
      const body: { data?: AssignedCopy; error?: string } = await response.json();
      if (!response.ok || !body.data) {
        throw new Error(body.error ?? 'Nepodařilo se přiřadit štítek');
      }

      setAssignedCopy(body.data);
      setJustAssigned(true);
      setLabelStatus(LABEL_STATUS.assigned);
      toast.success(`${formatLibraryLabelCode(labelCode)} je přiřazený ke knize „${book.title_cs}“`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nepodařilo se přiřadit štítek');
    } finally {
      setAssigningBookId(null);
    }
  };

  const resetForNextLabel = () => {
    setLabelCode(null);
    setManualLabelCode('');
    setLabelStatus(LABEL_STATUS.idle);
    setAssignedCopy(null);
    setJustAssigned(false);
    setQuery('');
    setResults(null);
    setShowBookScanner(false);
    setShowLabelScanner(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            1. Štítek výtisku
          </CardTitle>
          <CardDescription>Naskenuj nalepený QR kód nebo zadej číslo pod ním</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showLabelScanner && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-foreground">
              <BarcodeScanner
                options={{ delay: SCANNER_DELAY_MS, formats: ['qr_code'] }}
                onCapture={handleLabelCapture}
                paused={false}
              />
              <p className="absolute inset-x-3 bottom-3 rounded-md bg-background/90 px-3 py-2 text-center text-xs text-foreground">
                Namiř kameru na QR štítek Tappky
              </p>
            </div>
          )}

          <form onSubmit={handleManualLabel} className="flex gap-2">
            <Input
              value={manualLabelCode}
              onChange={(event) => setManualLabelCode(event.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Např. 001"
              aria-label="Číslo knihovního štítku"
            />
            <Button type="submit" variant="outline" disabled={!manualLabelCode.trim()}>
              Použít
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowLabelScanner((visible) => !visible)}
              aria-label={showLabelScanner ? 'Zavřít skener štítku' : 'Skenovat štítek'}
            >
              {showLabelScanner ? <X className="size-4" /> : <Camera className="size-4" />}
            </Button>
          </form>

          {labelCode != null && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-primary/10 px-4 py-3">
              <div>
                <p className="text-xs font-medium text-primary">Vybraný štítek</p>
                <p className="font-heading text-2xl font-bold text-primary">
                  {formatLibraryLabelCode(labelCode)}
                </p>
              </div>
              {labelStatus === LABEL_STATUS.checking && <Spinner className="size-5 text-primary" />}
            </div>
          )}
        </CardContent>
      </Card>

      {labelStatus === LABEL_STATUS.assigned && assignedCopy && (
        <Card className={justAssigned ? 'border-success bg-success/10' : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className={justAssigned ? 'size-5 text-success-strong' : 'size-5 text-primary'} />
              {justAssigned ? 'Výtisk je připravený' : 'Štítek už je přiřazený'}
            </CardTitle>
            <CardDescription>
              {formatLibraryLabelCode(assignedCopy.label_code)} · {assignedCopy.book.title_cs}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/cteni/knihy/${assignedCopy.book_id}`}>Otevřít knihu</Link>
            </Button>
            <Button onClick={resetForNextLabel} className="gap-2">
              <RotateCcw className="size-4" />
              Další štítek
            </Button>
          </CardContent>
        </Card>
      )}

      {labelStatus === LABEL_STATUS.error && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-sm text-destructive">Štítek se nepodařilo ověřit</p>
            <Button type="button" variant="outline" onClick={() => setCheckAttempt((attempt) => attempt + 1)}>
              Zkusit znovu
            </Button>
          </CardContent>
        </Card>
      )}

      {labelStatus === LABEL_STATUS.unassigned && labelCode != null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              2. Kniha
            </CardTitle>
            <CardDescription>Najdi titul v katalogu podle názvu, autora:ky nebo ISBN</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {showBookScanner && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-foreground">
                <BarcodeScanner
                  options={{
                    delay: SCANNER_DELAY_MS,
                    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
                  }}
                  onCapture={handleBookCapture}
                  paused={false}
                />
                <p className="absolute inset-x-3 bottom-3 rounded-md bg-background/90 px-3 py-2 text-center text-xs text-foreground">
                  Namiř kameru na ISBN čárový kód knihy
                </p>
              </div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSearch();
              }}
              className="flex gap-2"
            >
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Název, autor:ka nebo ISBN"
                aria-label="Hledat knihu"
              />
              <Button type="submit" disabled={!query.trim() || searching} size="icon" aria-label="Hledat">
                {searching ? <Spinner className="size-4" /> : <Search className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowBookScanner((visible) => !visible)}
                aria-label={showBookScanner ? 'Zavřít skener ISBN' : 'Skenovat ISBN'}
              >
                {showBookScanner ? <X className="size-4" /> : <Camera className="size-4" />}
              </Button>
            </form>

            {results?.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
                  <EmptyTitle>Kniha není v katalogu</EmptyTitle>
                  <EmptyDescription>Nejdřív ji přidej do BOBa a potom se vrať ke štítku</EmptyDescription>
                </EmptyHeader>
                <Button asChild variant="outline">
                  <Link href={`/cteni/knihy/nova?q=${encodeURIComponent(query)}&from=${encodeURIComponent(`/knihovna/stitky?label=${labelCode}`)}`}>
                    Přidat knihu
                  </Link>
                </Button>
              </Empty>
            )}

            {results && results.length > 0 && (
              <div className="space-y-2" aria-live="polite">
                {results.map((book) => (
                  <div key={book.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <div className="flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                      {book.google_books_cover_url ? (
                        <StorageImage
                          storageKey={book.google_books_cover_url}
                          alt=""
                          width={44}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <BookOpen className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{book.title_cs}</p>
                      <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                      {book.isbn_13 && (
                        <p className="text-xs text-muted-foreground">ISBN {book.isbn_13}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={assigningBookId != null}
                      onClick={() => void handleAssign(book)}
                    >
                      {assigningBookId === book.id ? <Spinner className="size-4" /> : 'Přiřadit'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
