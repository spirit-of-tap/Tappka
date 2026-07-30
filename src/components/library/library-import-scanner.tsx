'use client';

import { useState, useCallback } from 'react';
import { BookOpen, Search, Plus, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { BarcodeScanner } from 'react-barcode-scanner';
import 'react-barcode-scanner/polyfill';

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { StorageImage } from '@/components/storage/storage-image';

interface LocalBook {
  id: string;
  title_cs: string;
  author: string;
  isbn_13: string | null;
  google_books_cover_url: string | null;
}

export function LibraryImportScanner() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocalBook[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;
    setSearching(true);
    setResults(null);
    try {
      const res = await fetch(`/api/books/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setResults(data ?? []);
      if (!data || data.length === 0) {
        toast.info('Nenalezeny žádné knihy v katalogu. Nejprve přidejte knihu do katalogu.');
      }
    } catch {
      toast.error('Nepodařilo se vyhledat knihy');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleImport = async (book: LocalBook) => {
    setImportingId(book.id);
    try {
      const res = await fetch('/api/library/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: book.id, isbn_13: book.isbn_13 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Chyba');
      }
      toast.success(`"${book.title_cs}" přidána do knihovny`);
    } catch {
      toast.error('Nepodařilo se přidat knihu do knihovny');
    } finally {
      setImportingId(null);
    }
  };

  const onCapture = useCallback((barcodes: DetectedBarcode[]) => {
    if (barcodes.length > 0) {
      const value = barcodes[0].rawValue;
      setQuery(value);
      setShowScanner(false);
      handleSearch(value);
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zadejte název knihy, autora nebo ISBN…"
          aria-label="Název knihy, autor nebo ISBN"
          className="flex-1"
        />
        <Button type="submit" disabled={!query.trim() || searching} className="gap-2">
          {searching ? <Spinner className="size-4" /> : <Search className="size-4" />}
          Hledat
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowScanner(!showScanner)}
          className="gap-2"
        >
          {showScanner ? <X className="size-4" /> : <Camera className="size-4" />}
          {showScanner ? 'Zavřít' : 'Skenovat'}
        </Button>
      </form>

      {showScanner && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <BarcodeScanner
            options={{ delay: 500, formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }}
            onCapture={onCapture}
            paused={false}
          />
          <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white text-xs bg-black/60 px-3 py-1 rounded-full">
            Namiřte kameru na čárový kód ISBN
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Vyhledávejte v existujícím katalogu knih. Pokud kniha v katalogu není,
        nejprve ji přidejte přes stránku Přidat knihu.
      </p>

      {searching && (
        <div className="flex justify-center py-8">
          <Spinner className="size-6" />
        </div>
      )}

      {results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{results.length} nalezených knih</p>
          {results.map((book) => (
            <div
              key={book.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-card"
            >
              <div className="shrink-0 w-10 h-14 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                {book.google_books_cover_url ? (
                  <StorageImage
                    storageKey={book.google_books_cover_url}
                    alt={book.title_cs}
                    width={40}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookOpen className="size-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-snug truncate">{book.title_cs}</p>
                <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                {book.isbn_13 && (
                  <p className="text-xs text-muted-foreground/60">ISBN: {book.isbn_13}</p>
                )}
              </div>
              <Button
                onClick={() => handleImport(book)}
                disabled={importingId === book.id}
                size="sm"
                className="gap-1.5"
              >
                {importingId === book.id ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Přidat do knihovny
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
