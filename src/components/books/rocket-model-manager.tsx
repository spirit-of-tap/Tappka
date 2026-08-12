'use client';

import { useState } from 'react';
import { BookOpen, Plus, Rocket, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { BookRowHeader } from './book-row-header';
import { ListStatusBadge } from './book-status-badges';
import { useBookSearch } from './use-book-search';
import type { BookWithProfiles } from '@/lib/books/types';

interface RocketModelManagerProps {
  books: BookWithProfiles[];
  onAdd: (book: BookWithProfiles) => Promise<boolean>;
  onRemove: (bookId: string) => Promise<boolean>;
}

export function RocketModelManager({ books, onAdd, onRemove }: RocketModelManagerProps) {
  const { query, results, searching, search, setResults } = useBookSearch({ excludeIds: books.map((b) => b.id) });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAdd = async (book: BookWithProfiles) => {
    setAddingId(book.id);
    try {
      const ok = await onAdd(book);
      if (ok) setResults((prev) => prev.filter((b) => b.id !== book.id));
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (bookId: string) => {
    setRemovingId(bookId);
    try {
      await onRemove(bookId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-md border p-4">
        <p className="text-sm font-semibold">Zařadit knihu do raketového modelu</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => void search(e.target.value)}
            placeholder="Vyhledej knihu…"
            className="pl-8"
          />
        </div>
        {searching && <Spinner className="size-4" />}
        {!searching && results.length === 0 && query.trim().length >= 2 && (
          <p className="text-xs text-muted-foreground">Žádné knihy nenalezeny.</p>
        )}
        {results.length > 0 && (
          <ul className="divide-y rounded-md border">
            {results.map((book) => (
              <li key={book.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{book.title_cs}</p>
                    <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleAdd(book)}
                  disabled={addingId === book.id}
                  className="gap-1 shrink-0"
                >
                  {addingId === book.id ? <Spinner className="size-3" /> : <Plus className="size-3" />}
                  Přidat
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {books.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Rocket className="size-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Žádné knihy v raketovém modelu</p>
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {books.map((book) => (
            <div key={book.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <BookRowHeader book={book} coverSize="md" titleClassName="block">
                  <ListStatusBadge status={book.list_status} className="mt-1" />
                </BookRowHeader>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => void handleRemove(book.id)}
                disabled={removingId === book.id}
                title="Odebrat z raketového modelu"
              >
                {removingId === book.id ? <Spinner className="size-4" /> : <X className="size-4" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
