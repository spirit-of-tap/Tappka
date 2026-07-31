'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CoachBookRow } from './coach-book-row';
import { CoachHighlightRow } from './coach-highlight-row';
import { Badge } from '@/components/ui/badge';
import type { BookListStatus, BookWithProfiles, HighlightCategory } from '@/lib/books/types';

const HIGHLIGHT_LIMIT = 50;

interface CoachDashboardProps {
  initialProcessing: BookWithProfiles[];
  initialArchived: BookWithProfiles[];
  initialHighlighted: BookWithProfiles[];
}

export function CoachDashboard({ initialProcessing, initialArchived, initialHighlighted }: CoachDashboardProps) {
  const [processing, setProcessing] = useState(initialProcessing);
  const [archived, setArchived] = useState(initialArchived);
  const [highlighted, setHighlighted] = useState(initialHighlighted);

  const handleClassify = async (
    book: BookWithProfiles,
    listStatus: BookListStatus,
    bookPoints: 1 | 2 | 3 | null,
    reason: string,
  ): Promise<boolean> => {
    const res = await fetch(`/api/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'classify',
        list_status: listStatus,
        book_points: bookPoints,
        status_reason: reason,
      }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se knihu zařadit.');
      return false;
    }

    const updated: BookWithProfiles = { ...book, list_status: listStatus };
    if (listStatus === 'archived') {
      updated.book_points = 0;
      updated.list_status_reason = reason;
      setProcessing((prev) => prev.filter((b) => b.id !== book.id));
      setArchived((prev) => [updated, ...prev]);
    } else {
      updated.book_points = bookPoints ?? book.book_points;
      setProcessing((prev) => prev.filter((b) => b.id !== book.id));
    }
    toast.success('Kniha zařazena.');
    return true;
  };

  const handleSetHighlight = async (
    bookId: string,
    category: HighlightCategory,
    description: string | null,
    highlightedFlag: boolean,
  ): Promise<boolean> => {
    const res = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'highlight',
        highlighted: highlightedFlag,
        category,
        description,
      }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se upravit výběr.');
      return false;
    }

    if (highlightedFlag) {
      const json = await res.json();
      const highlight: BookWithProfiles['highlight'] = json.data ?? null;
      setHighlighted((prev) =>
        prev.map((b) => (b.id === bookId ? { ...b, highlight } : b)),
      );
    } else {
      setHighlighted((prev) => prev.filter((b) => b.id !== bookId));
    }
    toast.success(highlightedFlag ? 'Výběr uložen.' : 'Kniha odebrána z výběru.');
    return true;
  };

  const handleRemove = async (bookId: string): Promise<boolean> => {
    const res = await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Nepodařilo se knihu smazat.');
      return false;
    }
    setProcessing((prev) => prev.filter((b) => b.id !== bookId));
    setArchived((prev) => prev.filter((b) => b.id !== bookId));
    setHighlighted((prev) => prev.filter((b) => b.id !== bookId));
    toast.success('Kniha odebrána.');
    return true;
  };

  return (
    <Tabs defaultValue="processing">
      <TabsList>
        <TabsTrigger value="processing" className="gap-2">
          Ke zpracování
          {processing.length > 0 && <Badge variant="destructive" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{processing.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="highlighted" className="gap-2">
          50 vybraných
          {highlighted.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{highlighted.length}/{HIGHLIGHT_LIMIT}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="archived" className="gap-2">
          Archivované
          {archived.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{archived.length}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="processing" className="mt-4">
        {processing.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <BookOpen className="size-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Žádné knihy ke zpracování</p>
          </div>
        ) : (
          <div>
            {processing.map((book) => (
              <CoachBookRow
                key={book.id}
                book={book}
                onClassify={handleClassify}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="highlighted" className="mt-4">
        {highlighted.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <Sparkles className="size-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Zatím není vybrána žádná kniha</p>
          </div>
        ) : (
          <div>
            {highlighted.map((book) => (
              <CoachHighlightRow
                key={book.id}
                book={book}
                onSetHighlight={handleSetHighlight}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="archived" className="mt-4">
        {archived.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Žádné archivované knihy</p>
          </div>
        ) : (
          <div>
            {archived.map((book) => (
              <CoachBookRow
                key={book.id}
                book={book}
                onClassify={handleClassify}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
