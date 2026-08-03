'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CoachProcessingRow } from './coach-book-row';
import { CoachListTable, type ListKind } from './coach-list-table';
import { CategoryManager } from './category-manager';
import { DeleteBookDialog } from './delete-book-dialog';
import { BookRowHeader } from './book-row-header';
import { ListStatusBadge } from './book-status-badges';
import { RocketModelManager } from './rocket-model-manager';
import { LibraryImportScanner } from '@/components/library/library-import-scanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { BookListStatus, BookWithProfiles, HighlightCategory } from '@/lib/books/types';

interface CoachDashboardProps {
  initialProcessing: BookWithProfiles[];
  initialShortlisted: BookWithProfiles[];
  initialLonglisted: BookWithProfiles[];
  initialHighlighted: BookWithProfiles[];
  initialArchived: BookWithProfiles[];
  initialCategories: HighlightCategory[];
  initialRocketModel: BookWithProfiles[];
}

export function CoachDashboard({
  initialProcessing,
  initialShortlisted,
  initialLonglisted,
  initialHighlighted,
  initialArchived,
  initialCategories,
  initialRocketModel,
}: CoachDashboardProps) {
  const [processing, setProcessing] = useState(initialProcessing);
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [longlisted, setLonglisted] = useState(initialLonglisted);
  const [highlighted, setHighlighted] = useState(initialHighlighted);
  const [archived, setArchived] = useState(initialArchived);
  const [categories, setCategories] = useState(initialCategories);
  const [rocketModel, setRocketModel] = useState(initialRocketModel);
  const [archiveDelete, setArchiveDelete] = useState<BookWithProfiles | null>(null);

  const classify = async (
    book: BookWithProfiles,
    listStatus: BookListStatus,
    bookPoints: number | null,
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

    const updated: BookWithProfiles = {
      ...book,
      list_status: listStatus,
      book_points: listStatus === 'archived' ? 0 : (bookPoints ?? book.book_points),
      list_status_reason: reason,
    };

    const removeFrom = (setter: (fn: (prev: BookWithProfiles[]) => BookWithProfiles[]) => void) =>
      setter((prev) => prev.filter((b) => b.id !== book.id));

    removeFrom(setProcessing);
    removeFrom(setShortlisted);
    removeFrom(setLonglisted);
    removeFrom(setArchived);

    if (listStatus === 'shortlist') setShortlisted((prev) => [updated, ...prev]);
    else if (listStatus === 'longlist') setLonglisted((prev) => [updated, ...prev]);
    else if (listStatus === 'archived') setArchived((prev) => [updated, ...prev]);

    return true;
  };

  const handleApprove = (book: BookWithProfiles, points: 1 | 2 | 3, reason: string): Promise<boolean> =>
    classify(book, 'longlist', points, reason).then((ok) => {
      if (ok) toast.success('Kniha schválena do longlistu.');
      return ok;
    });

  const handleReject = (book: BookWithProfiles, reason: string): Promise<boolean> =>
    classify(book, 'archived', 0, reason).then((ok) => {
      if (ok) toast.success('Kniha odmítnuta (archivováno).');
      return ok;
    });

  const handleMove = (book: BookWithProfiles, targetStatus: ListKind): Promise<boolean> => {
    const points = Math.round(Number(book.book_points ?? 1)) as 1 | 2 | 3;
    return classify(book, targetStatus, points, book.list_status_reason ?? '').then((ok) => {
      if (ok) toast.success(targetStatus === 'shortlist' ? 'Přesunuto do shortlistu.' : 'Přesunuto zpět do longlistu.');
      return ok;
    });
  };

  const refreshBook = (prev: BookWithProfiles[], bookId: string, patch: Partial<BookWithProfiles>) =>
    prev.map((b) => (b.id === bookId ? { ...b, ...patch } : b));

  const handlePointsSaved = (book: BookWithProfiles) => {
    setShortlisted((prev) => refreshBook(prev, book.id, { book_points: book.book_points }));
    setLonglisted((prev) => refreshBook(prev, book.id, { book_points: book.book_points }));
  };

  const handleEdited = (book: BookWithProfiles) => {
    setShortlisted((prev) => refreshBook(prev, book.id, book));
    setLonglisted((prev) => refreshBook(prev, book.id, book));
    setProcessing((prev) => refreshBook(prev, book.id, book));
    setArchived((prev) => refreshBook(prev, book.id, book));
    setHighlighted((prev) => refreshBook(prev, book.id, book));
    setRocketModel((prev) => {
      if (!book.is_rocket_model) return prev.filter((b) => b.id !== book.id);
      const exists = prev.some((b) => b.id === book.id);
      return exists ? refreshBook(prev, book.id, book) : [book, ...prev];
    });
  };

  const handleDeleted = (bookId: string) => {
    setProcessing((prev) => prev.filter((b) => b.id !== bookId));
    setShortlisted((prev) => prev.filter((b) => b.id !== bookId));
    setLonglisted((prev) => prev.filter((b) => b.id !== bookId));
    setHighlighted((prev) => prev.filter((b) => b.id !== bookId));
    setArchived((prev) => prev.filter((b) => b.id !== bookId));
    setRocketModel((prev) => prev.filter((b) => b.id !== bookId));
  };

  const handleAddRocketModel = async (book: BookWithProfiles): Promise<boolean> => {
    const res = await fetch(`/api/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', is_rocket_model: true }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se zařadit knihu do raketového modelu.');
      return false;
    }

    const updated = { ...book, is_rocket_model: true };
    setRocketModel((prev) => [updated, ...prev]);
    const patch = { is_rocket_model: true };
    setProcessing((prev) => refreshBook(prev, book.id, patch));
    setShortlisted((prev) => refreshBook(prev, book.id, patch));
    setLonglisted((prev) => refreshBook(prev, book.id, patch));
    setArchived((prev) => refreshBook(prev, book.id, patch));
    setHighlighted((prev) => refreshBook(prev, book.id, patch));
    toast.success('Kniha zařazena do raketového modelu.');
    return true;
  };

  const handleRemoveRocketModel = async (bookId: string): Promise<boolean> => {
    const res = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', is_rocket_model: false }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se odebrat knihu z raketového modelu.');
      return false;
    }

    setRocketModel((prev) => prev.filter((b) => b.id !== bookId));
    const patch = { is_rocket_model: false };
    setProcessing((prev) => refreshBook(prev, bookId, patch));
    setShortlisted((prev) => refreshBook(prev, bookId, patch));
    setLonglisted((prev) => refreshBook(prev, bookId, patch));
    setArchived((prev) => refreshBook(prev, bookId, patch));
    setHighlighted((prev) => refreshBook(prev, bookId, patch));
    toast.success('Kniha odebrána z raketového modelu.');
    return true;
  };

  const handleSetHighlight = async (book: BookWithProfiles, categoryId: string): Promise<boolean> => {
    const res = await fetch(`/api/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'highlight', highlight_category_id: categoryId }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se zařadit knihu do výběru.');
      return false;
    }

    const category = categories.find((c) => c.id === categoryId) ?? null;
    const updated = { ...book, highlight_category: category };
    setHighlighted((prev) => {
      const exists = prev.some((b) => b.id === book.id);
      if (!exists) return [updated, ...prev];
      return prev.map((b) => (b.id === book.id ? updated : b));
    });
    const patch = { highlight_category: category };
    setProcessing((prev) => refreshBook(prev, book.id, patch));
    setShortlisted((prev) => refreshBook(prev, book.id, patch));
    setLonglisted((prev) => refreshBook(prev, book.id, patch));
    setArchived((prev) => refreshBook(prev, book.id, patch));
    toast.success('Kniha zařazena do výběru.');
    return true;
  };

  const handleRemoveHighlight = async (bookId: string): Promise<boolean> => {
    const res = await fetch(`/api/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unhighlight' }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se odebrat knihu z výběru.');
      return false;
    }

    const patch = { highlight_category: null };
    setHighlighted((prev) => prev.filter((b) => b.id !== bookId));
    setProcessing((prev) => refreshBook(prev, bookId, patch));
    setShortlisted((prev) => refreshBook(prev, bookId, patch));
    setLonglisted((prev) => refreshBook(prev, bookId, patch));
    setArchived((prev) => refreshBook(prev, bookId, patch));
    toast.success('Kniha odebrána z výběru.');
    return true;
  };

  const handleCreateCategory = async (name: string, description: string): Promise<boolean> => {
    const res = await fetch('/api/highlight-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se vytvořit kategorii.');
      return false;
    }
    const json = await res.json();
    setCategories((prev) => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Kategorie vytvořena.');
    return true;
  };

  const handleUpdateCategory = async (id: string, name: string, description: string): Promise<boolean> => {
    const res = await fetch(`/api/highlight-categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se upravit kategorii.');
      return false;
    }
    const json = await res.json();
    setCategories((prev) => prev.map((c) => (c.id === id ? json.data : c)).sort((a, b) => a.name.localeCompare(b.name)));
    const refreshCategory = (prev: BookWithProfiles[]) =>
      prev.map((b) => (b.highlight_category?.id === id ? { ...b, highlight_category: json.data } : b));
    setHighlighted((prev) => refreshCategory(prev));
    setProcessing((prev) => refreshCategory(prev));
    setShortlisted((prev) => refreshCategory(prev));
    setLonglisted((prev) => refreshCategory(prev));
    setArchived((prev) => refreshCategory(prev));
    toast.success('Kategorie upravena.');
    return true;
  };

  const handleDeleteCategory = async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/highlight-categories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Nepodařilo se smazat kategorii.');
      return false;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    const clearCategory = (prev: BookWithProfiles[]) =>
      prev.map((b) => (b.highlight_category?.id === id ? { ...b, highlight_category: null } : b));
    setHighlighted((prev) => clearCategory(prev).filter((b) => b.highlight_category));
    setProcessing((prev) => clearCategory(prev));
    setShortlisted((prev) => clearCategory(prev));
    setLonglisted((prev) => clearCategory(prev));
    setArchived((prev) => clearCategory(prev));
    toast.success('Kategorie smazána.');
    return true;
  };

  return (
    <Tabs defaultValue="processing">
      <TabsList>
        <TabsTrigger value="processing" className="gap-2">
          Ke zpracování
          {processing.length > 0 && <Badge variant="destructive" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{processing.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="shortlist" className="gap-2">
          Shortlist
          {shortlisted.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{shortlisted.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="longlist" className="gap-2">
          Longlist
          {longlisted.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{longlisted.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="highlighted" className="gap-2">
          Výběr
          {highlighted.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{highlighted.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="archived" className="gap-2">
          Zamítnuté
          {archived.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{archived.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="rocket-model" className="gap-2">
          Raketový model
          {rocketModel.length > 0 && <Badge variant="secondary" className="h-5 min-w-5 p-0 flex items-center justify-center text-xs">{rocketModel.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="import" className="gap-2">
          Import
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
              <CoachProcessingRow
                key={book.id}
                book={book}
                onApprove={handleApprove}
                onReject={handleReject}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="shortlist" className="mt-4">
        <CoachListTable
          kind="shortlist"
          books={shortlisted}
          categories={categories}
          onMove={handleMove}
          onPointsSaved={handlePointsSaved}
          onEdited={handleEdited}
          onDeleted={handleDeleted}
        />
      </TabsContent>

      <TabsContent value="longlist" className="mt-4">
        <CoachListTable
          kind="longlist"
          books={longlisted}
          categories={categories}
          onMove={handleMove}
          onPointsSaved={handlePointsSaved}
          onEdited={handleEdited}
          onDeleted={handleDeleted}
        />
      </TabsContent>

      <TabsContent value="highlighted" className="mt-4">
        <CategoryManager
          categories={categories}
          highlighted={highlighted}
          onCreate={handleCreateCategory}
          onUpdate={handleUpdateCategory}
          onDelete={handleDeleteCategory}
          onSetHighlight={handleSetHighlight}
          onRemoveHighlight={handleRemoveHighlight}
          onDeleted={handleDeleted}
        />
      </TabsContent>

      <TabsContent value="archived" className="mt-4">
        {archived.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Žádné zamítnuté knihy</p>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {archived.map((book) => (
              <div key={book.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <BookRowHeader book={book} coverSize="md" titleClassName="block">
                    {book.list_status_reason && (
                      <p className="text-xs text-muted-foreground mt-1">Důvod: {book.list_status_reason}</p>
                    )}
                    <ListStatusBadge status={book.list_status} className="mt-1" />
                  </BookRowHeader>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setArchiveDelete(book)}
                  title="Smazat knihu"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {archiveDelete && (
          <DeleteBookDialog
            book={archiveDelete}
            open={!!archiveDelete}
            onOpenChange={(open) => { if (!open) setArchiveDelete(null); }}
            onDeleted={handleDeleted}
          />
        )}
      </TabsContent>

      <TabsContent value="rocket-model" className="mt-4">
        <RocketModelManager
          books={rocketModel}
          onAdd={handleAddRocketModel}
          onRemove={handleRemoveRocketModel}
        />
      </TabsContent>

      <TabsContent value="import" className="mt-4">
        <LibraryImportScanner />
      </TabsContent>
    </Tabs>
  );
}
