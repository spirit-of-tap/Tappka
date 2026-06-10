'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { StorageImage } from '@/components/storage/storage-image';
import { BookOpen, Settings, X, Plus, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { TeamReadingList, TeamReadingListBook } from '@/lib/books/team-lists';

interface BookSearchResult {
  id: string;
  title: string;
  author: string;
  cover_path: string | null;
}

interface TeamReadingListPanelProps {
  list: TeamReadingList;
  hasTeam?: boolean;
  onDeleted?: () => void;
}

export function TeamReadingListPanel({ list, hasTeam = false, onDeleted }: TeamReadingListPanelProps) {
  const [editing, setEditing] = useState(false);
  const [localBooks, setLocalBooks] = useState<TeamReadingListBook[]>(list.books);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        { book_id: book.id, position: prev.length, note: null, book: { id: book.id, title: book.title, author: book.author, cover_path: book.cover_path } },
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
    if (res.ok) setLocalBooks((prev) => prev.filter((b) => b.book_id !== bookId));
  };

  const deleteList = async () => {
    if (!confirm(`Smazat seznam "${list.title}"?`)) return;
    await fetch(`/api/team-reading-lists/${list.id}`, { method: 'DELETE' });
    onDeleted?.();
  };

  const updateNote = async (bookId: string, note: string | null) => {
    setLocalBooks((prev) => prev.map((b) => b.book_id === bookId ? { ...b, note } : b));
    await fetch(`/api/team-reading-lists/${list.id}/books`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId, note }),
    });
  };

  const monthLabel = list.month
    ? new Date(list.month + '-01').toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b bg-muted/30">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-snug">{list.title}</p>
          <p className="text-xs text-muted-foreground">
            {list.team?.name}{monthLabel && ` · ${monthLabel}`}
          </p>
        </div>
        {hasTeam && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {editing && (
              <button onClick={deleteList} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10">
                <Trash2 className="size-3.5" />
              </button>
            )}
            <button
              onClick={() => { setEditing((e) => !e); setSearchQ(''); setSearchResults([]); }}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
            >
              {editing ? <X className="size-3.5" /> : <Settings className="size-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Book rows */}
      {localBooks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-3.5 py-4">
          {editing ? 'Vyhledej první knihu níže' : 'Zatím žádné knihy v tomto seznamu'}
        </p>
      ) : (
        <div className="divide-y">
          {localBooks.map((item) => (
            <BookRow
              key={item.book_id}
              item={item}
              editing={editing}
              onRemove={() => removeBook(item.book_id)}
              onNoteChange={(note) => updateNote(item.book_id, note)}
            />
          ))}
        </div>
      )}

      {/* Add book — edit mode only */}
      {editing && (
        <div className="px-3.5 py-2.5 border-t bg-muted/20 space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              placeholder="Přidat knihu…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="h-8 pl-7 text-xs"
            />
          </div>
          {searching && <p className="text-xs text-muted-foreground px-0.5">Hledám…</p>}
          {searchResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden bg-popover shadow-sm">
              {searchResults.slice(0, 5).map((book) => (
                <button
                  key={book.id}
                  onClick={() => addBook(book)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted transition-colors"
                >
                  <Plus className="size-3 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate">{book.title}</span>
                  <span className="text-xs text-muted-foreground truncate ml-auto shrink-0">{book.author}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BookRow({
  item, editing, onRemove, onNoteChange,
}: {
  item: TeamReadingListBook;
  editing: boolean;
  onRemove: () => void;
  onNoteChange: (note: string | null) => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note ?? '');

  const saveNote = () => {
    setEditingNote(false);
    const trimmed = noteValue.trim() || null;
    if (trimmed === item.note) return;
    onNoteChange(trimmed);
  };

  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5 group/row">
      <Link href={`/knihovna/${item.book.id}`} className="shrink-0 w-8 h-11 rounded overflow-hidden bg-muted flex items-center justify-center mt-0.5">
        {item.book.cover_path ? (
          <StorageImage storageKey={item.book.cover_path} alt={item.book.title} width={32} height={44} className="w-full h-full object-cover" />
        ) : (
          <BookOpen className="size-3 text-muted-foreground/30" />
        )}
      </Link>

      <div className="flex-1 min-w-0 py-0.5 space-y-0.5">
        <p className="text-sm font-medium leading-snug line-clamp-1">{item.book.title}</p>
        <p className="text-xs text-muted-foreground">{item.book.author}</p>

        {!editing && item.note && (
          <p className="text-xs text-muted-foreground/70 italic leading-relaxed line-clamp-2 pt-0.5">{item.note}</p>
        )}

        {editing && (
          editingNote ? (
            <input
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onBlur={saveNote}
              onKeyDown={(e) => e.key === 'Enter' && saveNote()}
              placeholder="Proč číst tuto knihu…"
              className="mt-1 w-full text-xs text-muted-foreground bg-transparent border-b border-border outline-none py-0.5 italic placeholder:text-muted-foreground/40"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setNoteValue(item.note ?? ''); setEditingNote(true); }}
              className="mt-1 text-xs text-muted-foreground/50 hover:text-muted-foreground italic transition-colors"
            >
              {item.note ? item.note : '+ Přidat důvod ke čtení…'}
            </button>
          )
        )}
      </div>

      {editing && (
        <button
          onClick={onRemove}
          className="shrink-0 mt-1 p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-all"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
