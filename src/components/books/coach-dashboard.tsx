'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerCount } from '@/components/ui/tabs';
import { CoachReviewQueue } from './coach-review-queue';
import { CoachCatalogView } from './coach-catalog-view';
import { CategoryManager } from './category-manager';
import { CoachLibraryTools } from './coach-library-tools';
import { suggestedBookPoints, type ReviewPoints } from '@/lib/books/points';
import { usePersistedState } from '@/lib/hooks/use-persisted-state';
import type { BookListStatus, BookWithProfiles, HighlightCategory } from '@/lib/books/types';
import type { ContentSourceStatus, ContentSourceWithProfiles } from '@/lib/content-sources/types';
import type { PhysicalLibraryBookItem } from '@/lib/library/types';

interface CoachDashboardProps {
  initialProcessing: BookWithProfiles[];
  initialPendingSources: ContentSourceWithProfiles[];
  initialShortlisted: BookWithProfiles[];
  initialLonglisted: BookWithProfiles[];
  initialArchived: BookWithProfiles[];
  initialCategories: HighlightCategory[];
  initialHighlighted: BookWithProfiles[];
  initialContentSources: ContentSourceWithProfiles[];
  initialLibraryInventory?: PhysicalLibraryBookItem[];
  initialTab?: string;
  initialSub?: string;
}

function normalizeTab(tab: string): 'processing' | 'catalog' | 'categories' | 'library' {
  if (tab === 'shortlist' || tab === 'longlist' || tab === 'archived' || tab === 'rocket-model' || tab === 'catalog') {
    return 'catalog';
  }
  if (tab === 'highlighted' || tab === 'categories') {
    return 'categories';
  }
  if (tab === 'import' || tab === 'library') {
    return 'library';
  }
  return 'processing';
}

export function CoachDashboard({
  initialProcessing,
  initialPendingSources,
  initialShortlisted,
  initialLonglisted,
  initialArchived,
  initialCategories,
  initialHighlighted,
  initialContentSources,
  initialLibraryInventory,
  initialTab,
  initialSub,
}: CoachDashboardProps) {
  const [rawTab, setRawTab] = usePersistedState<string>(
    'tappka:coach-dashboard:tab',
    initialTab ? normalizeTab(initialTab) : 'processing',
  );
  const activeTab = normalizeTab(rawTab);

  const [processing, setProcessing] = useState(initialProcessing);
  const [pendingSources, setPendingSources] = useState(initialPendingSources);
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [longlisted, setLonglisted] = useState(initialLonglisted);
  const [archived, setArchived] = useState(initialArchived);
  const [highlighted, setHighlighted] = useState(initialHighlighted);
  const [categories, setCategories] = useState(initialCategories);
  const [contentSources, setContentSources] = useState(initialContentSources);

  const catalogBooks = useMemo(
    () => [...shortlisted, ...longlisted, ...archived],
    [shortlisted, longlisted, archived],
  );

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

  const handleDecideBook = (
    book: BookWithProfiles,
    points: ReviewPoints,
    reason: string,
  ): Promise<boolean> => {
    if (points === 0) {
      return classify(book, 'archived', 0, reason).then((ok) => {
        if (ok) toast.success('Kniha zamítnuta (0 bodů).');
        return ok;
      });
    }
    return classify(book, 'longlist', points, reason).then((ok) => {
      if (ok) toast.success(`Kniha schválena do longlistu (${points} b.).`);
      return ok;
    });
  };

  const handleMoveBook = (book: BookWithProfiles, targetStatus: 'shortlist' | 'longlist'): Promise<boolean> => {
    const points = suggestedBookPoints(book.book_points);
    return classify(book, targetStatus, points, book.list_status_reason ?? '').then((ok) => {
      if (ok) {
        toast.success(targetStatus === 'shortlist' ? 'Přesunuto do shortlistu.' : 'Přesunuto zpět do longlistu.');
      }
      return ok;
    });
  };

  const handleRestoreBook = (book: BookWithProfiles): Promise<boolean> => {
    const points = suggestedBookPoints(book.book_points);
    return classify(book, 'longlist', points, book.list_status_reason ?? '').then((ok) => {
      if (ok) toast.success('Kniha obnovena z archivu do longlistu.');
      return ok;
    });
  };

  const handleToggleRocketModel = async (book: BookWithProfiles): Promise<boolean> => {
    const nextState = !book.is_rocket_model;
    const res = await fetch(`/api/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'edit', is_rocket_model: nextState }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se upravit zařazení do Rocket modelu.');
      return false;
    }

    const patch = { is_rocket_model: nextState };
    setShortlisted((prev) => refreshBook(prev, book.id, patch));
    setLonglisted((prev) => refreshBook(prev, book.id, patch));
    setArchived((prev) => refreshBook(prev, book.id, patch));
    setHighlighted((prev) => refreshBook(prev, book.id, patch));
    setProcessing((prev) => refreshBook(prev, book.id, patch));

    toast.success(nextState ? 'Kniha zařazena do Rocket modelu.' : 'Kniha odebrána z Rocket modelu.');
    return true;
  };

  const refreshBook = (prev: BookWithProfiles[], bookId: string, patch: Partial<BookWithProfiles>) =>
    prev.map((b) => (b.id === bookId ? { ...b, ...patch } : b));

  const handlePointsSaved = (book: BookWithProfiles) => {
    const patch = { book_points: book.book_points };
    setShortlisted((prev) => refreshBook(prev, book.id, patch));
    setLonglisted((prev) => refreshBook(prev, book.id, patch));
    setArchived((prev) => refreshBook(prev, book.id, patch));
    setHighlighted((prev) => refreshBook(prev, book.id, patch));
  };

  const handleBookEdited = (book: BookWithProfiles) => {
    setShortlisted((prev) => refreshBook(prev, book.id, book));
    setLonglisted((prev) => refreshBook(prev, book.id, book));
    setProcessing((prev) => refreshBook(prev, book.id, book));
    setArchived((prev) => refreshBook(prev, book.id, book));
    setHighlighted((prev) => refreshBook(prev, book.id, book));
  };

  const handleBookDeleted = (bookId: string) => {
    setProcessing((prev) => prev.filter((b) => b.id !== bookId));
    setShortlisted((prev) => prev.filter((b) => b.id !== bookId));
    setLonglisted((prev) => prev.filter((b) => b.id !== bookId));
    setHighlighted((prev) => prev.filter((b) => b.id !== bookId));
    setArchived((prev) => prev.filter((b) => b.id !== bookId));
  };

  const handleDecideSource = (
    source: ContentSourceWithProfiles,
    status: 'approved' | 'archived',
    points: number | null,
  ) => {
    setPendingSources((prev) => prev.filter((s) => s.id !== source.id));
    const updated: ContentSourceWithProfiles = {
      ...source,
      status,
      points: points ?? source.points,
    };
    setContentSources((prev) => [updated, ...prev.filter((s) => s.id !== source.id)]);
  };

  const handleUpdateSourceStatus = async (
    source: ContentSourceWithProfiles,
    status: ContentSourceStatus,
  ): Promise<boolean> => {
    const res = await fetch(`/api/content-sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, points: source.points }),
    });
    if (!res.ok) {
      toast.error('Nepodařilo se aktualizovat stav zdroje.');
      return false;
    }
    setContentSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, status } : s)),
    );
    toast.success(status === 'approved' ? 'Zdroj schválen.' : 'Zdroj archivován.');
    return true;
  };

  const handleUpdateSourcePoints = (
    source: ContentSourceWithProfiles,
    newPoints: number | null,
  ) => {
    setContentSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, points: newPoints } : s)),
    );
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

  const totalPending = processing.length + pendingSources.length;
  const totalCatalog = catalogBooks.length + contentSources.length;

  const tabs = [
    {
      value: 'processing',
      label: 'Ke schválení',
      count: totalPending,
      tone: 'attention' as const,
    },
    {
      value: 'catalog',
      label: 'Katalog',
      count: totalCatalog,
    },
    {
      value: 'categories',
      label: 'Výběr & kategorie',
      count: highlighted.length,
    },
    {
      value: 'library',
      label: 'Fyzická knihovna',
    },
  ];

  return (
    <Tabs value={activeTab} onValueChange={setRawTab}>
      <TabsList variant="line">
        {tabs.map(({ value, label, count, tone }) => (
          <TabsTrigger key={value} value={value}>
            {label}
            {count !== undefined && <TabsTriggerCount count={count} tone={tone} />}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* 1. KE SCHVÁLENÍ */}
      <TabsContent value="processing" className="mt-4">
        <CoachReviewQueue
          books={processing}
          sources={pendingSources}
          initialSub={initialSub === 'sources' ? 'sources' : 'books'}
          onDecideBook={handleDecideBook}
          onEditedBook={handleBookEdited}
          onDeletedBook={handleBookDeleted}
          onDecideSource={handleDecideSource}
        />
      </TabsContent>

      {/* 2. KATALOG */}
      <TabsContent value="catalog" className="mt-4">
        <CoachCatalogView
          books={catalogBooks}
          sources={contentSources}
          categories={categories}
          onMoveBook={handleMoveBook}
          onRestoreBook={handleRestoreBook}
          onToggleRocketModel={handleToggleRocketModel}
          onPointsSaved={handlePointsSaved}
          onBookEdited={handleBookEdited}
          onBookDeleted={handleBookDeleted}
          onUpdateSourceStatus={handleUpdateSourceStatus}
          onUpdateSourcePoints={handleUpdateSourcePoints}
        />
      </TabsContent>

      {/* 3. VÝBĚR & KATEGORIE */}
      <TabsContent value="categories" className="mt-4">
        <CategoryManager
          categories={categories}
          highlighted={highlighted}
          onCreate={handleCreateCategory}
          onUpdate={handleUpdateCategory}
          onDelete={handleDeleteCategory}
          onSetHighlight={handleSetHighlight}
          onRemoveHighlight={handleRemoveHighlight}
          onEdited={handleBookEdited}
          onDeleted={handleBookDeleted}
        />
      </TabsContent>

      {/* 4. FYZICKÁ KNIHOVNA */}
      <TabsContent value="library" className="mt-4">
        <CoachLibraryTools initialInventory={initialLibraryInventory ?? []} />
      </TabsContent>
    </Tabs>
  );
}
