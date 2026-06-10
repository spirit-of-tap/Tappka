'use client';

import { useState, useRef, useEffect } from 'react';
import { StorageImage } from '@/components/storage/storage-image';
import { BookOpen, Settings, X, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TeamReadingList, TeamReadingListBook } from '@/lib/books/team-lists';

interface BookSearchResult {
  id: string;
  title: string;
  author: string;
  cover_path: string | null;
}

interface TeamReadingListCardProps {
  list: TeamReadingList;
  hasTeam?: boolean;
}

export function TeamReadingListCard({ list, hasTeam = false }: TeamReadingListCardProps) {
  const [editing, setEditing] = useState(false);
  const [localBooks, setLocalBooks] = useState<TeamReadingListBook[]>(list.books);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const covers = localBooks.slice(0, 4);

  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    clearTimeout(searchTimeout.current ?? undefined);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(searchQ)}`);
        if (res.ok) {
          const { data } = await res.json();
          const existingIds = new Set(localBooks.map((b) => b.book_id));
          setSearchResults((data as BookSearchResult[]).filter((b) => !existingIds.has(b.id)));
        }
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [searchQ, localBooks]);

  const addBook = async (book: BookSearchResult) => {
    const res = await fetch(`/api/team-reading-lists/${list.id}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: book.id, position: localBooks.length }),
    });
    if (res.ok) {
      setLocalBooks((prev) => [
        ...prev,
        { book_id: book.id, position: prev.length, book: { id: book.id, title: book.title, author: book.author, cover_path: book.cover_path } },
      ]);
      setSearchQ('');
      setSearchResults([]);
    }
  };

  const removeBook = async (bookId: string) => {
    const res = await fetch(`/api/team-reading-lists/${list.id}/books`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId }),
    });
    if (res.ok) {
      setLocalBooks((prev) => prev.filter((b) => b.book_id !== bookId));
    }
  };

  const deleteList = async () => {
    if (!confirm(`Smazat seznam "${list.title}"?`)) return;
    await fetch(`/api/team-reading-lists/${list.id}`, { method: 'DELETE' });
    // Reload page to remove the card
    window.location.reload();
  };

  if (editing) {
    return (
      <div className="shrink-0 w-72 rounded-xl border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm line-clamp-1">{list.title}</p>
          <div className="flex items-center gap-1">
            <button onClick={deleteList} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="size-3.5" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Current books */}
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {localBooks.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">Žádné knihy</p>
          )}
          {localBooks.map(({ book, book_id }) => (
            <div key={book_id} className="flex items-center gap-2 group">
              <div className="shrink-0 w-7 h-9 rounded overflow-hidden bg-muted">
                {book.cover_path ? (
                  <StorageImage storageKey={book.cover_path} alt={book.title} width={28} height={36} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><BookOpen className="size-3 text-muted-foreground/30" /></div>
                )}
              </div>
              <p className="flex-1 text-xs truncate">{book.title}</p>
              <button onClick={() => removeBook(book_id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Search to add */}
        <div className="space-y-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              placeholder="Přidat knihu..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="h-7 pl-6 text-xs"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden bg-popover shadow-sm">
              {searchResults.slice(0, 5).map((book) => (
                <button
                  key={book.id}
                  onClick={() => addBook(book)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted transition-colors"
                >
                  <Plus className="size-3 shrink-0 text-muted-foreground" />
                  <span className="text-xs truncate">{book.title}</span>
                  <span className="text-xs text-muted-foreground truncate ml-auto shrink-0">{book.author}</span>
                </button>
              ))}
            </div>
          )}
          {searching && <p className="text-xs text-muted-foreground px-1">Hledám…</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 w-44 rounded-xl border bg-card p-3 space-y-2.5 hover:shadow-md transition-shadow group/card relative">
      {hasTeam && (
        <button
          onClick={() => setEditing(true)}
          className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 p-1 rounded-md bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-all"
        >
          <Settings className="size-3" />
        </button>
      )}

      {/* Stacked covers */}
      <div className="flex gap-1 h-20">
        {covers.length === 0 ? (
          <div className="w-full h-full rounded-md bg-muted flex items-center justify-center">
            <BookOpen className="size-6 text-muted-foreground/40" />
          </div>
        ) : (
          covers.map(({ book }, i) => (
            <div
              key={book.id}
              className="flex-1 rounded-md overflow-hidden bg-muted"
              style={{ opacity: 1 - i * 0.08 }}
            >
              {book.cover_path ? (
                <StorageImage
                  storageKey={book.cover_path}
                  alt={book.title}
                  width={40}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="size-4 text-muted-foreground/30" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div>
        <p className="font-semibold text-sm leading-snug line-clamp-1">{list.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {list.team?.name}
          {list.month && ` · ${new Date(list.month + '-01').toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}`}
        </p>
      </div>
    </div>
  );
}
