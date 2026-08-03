'use client';

import { useState } from 'react';
import type { BookWithProfiles } from '@/lib/books/types';

interface UseBookSearchOptions {
  /** Ids to exclude from results (e.g. already-selected books, or the book being deleted). */
  excludeIds?: string[];
  minLength?: number;
}

/**
 * Fetch-as-you-type search over `GET /api/books?q=&status=all&page_size=10`.
 * Was previously copy-pasted near-identically in `category-book-search.tsx`
 * and `delete-book-dialog.tsx`.
 */
export function useBookSearch({ excludeIds = [], minLength = 2 }: UseBookSearchOptions = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookWithProfiles[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < minLength) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/books?q=${encodeURIComponent(q.trim())}&status=all&page_size=10`);
      const json = await res.json();
      setResults((json.data ?? []).filter((b: BookWithProfiles) => !excludeIds.includes(b.id)));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const reset = () => {
    setQuery('');
    setResults([]);
  };

  return { query, setQuery, results, searching, search, reset, setResults };
}
