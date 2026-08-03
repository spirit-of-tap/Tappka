'use client';

import { useState } from 'react';
import { BookOpen, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useBookSearch } from './use-book-search';
import type { BookWithProfiles } from '@/lib/books/types';

interface CategoryBookSearchProps {
  /** The ids already in the selection — excluded from results. */
  excludedBookIds: string[];
  /** Called with the full book when added; the category is implied by context. */
  onAdd: (book: BookWithProfiles) => Promise<boolean>;
}

export function CategoryBookSearch({ excludedBookIds, onAdd }: CategoryBookSearchProps) {
  const { query, setQuery, results, searching, search, setResults } = useBookSearch({ excludeIds: excludedBookIds });
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleAdd = async (book: BookWithProfiles) => {
    setAddingId(book.id);
    try {
      const ok = await onAdd(book);
      if (ok) {
        setResults((prev) => prev.filter((b) => b.id !== book.id));
        setQuery('');
      }
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => void search(e.target.value)}
          placeholder="Vyhledej knihu a přidej…"
          className="pl-8"
          autoFocus
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
  );
}
