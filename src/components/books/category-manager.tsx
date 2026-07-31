'use client';

import { useState } from 'react';
import { BookPlus, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/responsive-alert-dialog';
import { CoachHighlightRow } from './coach-highlight-row';
import { CategoryBookSearch } from './category-book-search';
import type { BookWithProfiles, HighlightCategory } from '@/lib/books/types';

interface CategoryManagerProps {
  categories: HighlightCategory[];
  highlighted: BookWithProfiles[];
  onCreate: (name: string, description: string) => Promise<boolean>;
  onUpdate: (id: string, name: string, description: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onSetHighlight: (book: BookWithProfiles, categoryId: string) => Promise<boolean>;
  onRemoveHighlight: (bookId: string) => Promise<boolean>;
  onDeleted: (bookId: string) => void;
}

export function CategoryManager({
  categories,
  highlighted,
  onCreate,
  onUpdate,
  onDelete,
  onSetHighlight,
  onRemoveHighlight,
  onDeleted,
}: CategoryManagerProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [addForCategoryId, setAddForCategoryId] = useState<string | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<HighlightCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCreating(false);
    setEditingId(null);
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = editingId
      ? await onUpdate(editingId, name.trim(), description.trim())
      : await onCreate(name.trim(), description.trim());
    setBusy(false);
    if (ok) resetForm();
  };

  const handleAdd = async (book: BookWithProfiles) => {
    if (!addForCategoryId) return false;
    const ok = await onSetHighlight(book, addForCategoryId);
    if (ok) setAddForCategoryId(null);
    return ok;
  };

  const confirmDelete = async () => {
    if (!deleteCategory) return;
    setDeleting(true);
    const ok = await onDelete(deleteCategory.id);
    setDeleting(false);
    if (ok) setDeleteCategory(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Kategorie výběru</h3>
        {!creating && !editingId && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="gap-1">
            <Plus className="size-3" />
            Nová kategorie
          </Button>
        )}
      </div>

      {(creating || editingId) && (
        <div className="space-y-2 rounded-md border p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Název</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Např. Koučem doporučené" className="text-sm h-8" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Popis (volitelné)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Co tato kategorie znamená?" className="text-sm h-8" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={!name.trim() || busy} className="gap-1">
              {busy ? <Spinner className="size-3" /> : <Save className="size-3" />}
              {editingId ? 'Uložit' : 'Vytvořit'}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>Zrušit</Button>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Zatím žádné kategorie. Vytvoř první, aby bylo možné zařazovat knihy do výběru.
        </p>
      ) : (
        <div className="space-y-5">
          {categories.map((category) => {
            const books = highlighted.filter((b) => b.highlight_category?.id === category.id);
            const addOpen = addForCategoryId === category.id;
            return (
              <div key={category.id}>
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h4 className="text-sm font-semibold">{category.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {books.length}
                  </Badge>
                  {category.description && (
                    <span className="truncate text-xs text-muted-foreground">— {category.description}</span>
                  )}
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => { setEditingId(category.id); setName(category.name); setDescription(category.description ?? ''); }}
                      title="Upravit kategorii"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteCategory(category)}
                      title="Smazat kategorii (knihy zůstanou, jen přestanou být ve výběru)"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {books.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    Zatím žádné knihy v této kategorii.
                  </p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {books.map((book) => (
                      <div key={book.id} className="px-3">
                        <CoachHighlightRow
                          book={book}
                          categories={categories}
                          onSetHighlight={onSetHighlight}
                          onRemoveHighlight={onRemoveHighlight}
                          onDeleted={onDeleted}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAddForCategoryId(addOpen ? null : category.id)}
                    className="gap-1 text-muted-foreground"
                  >
                    <BookPlus className="size-3" />
                    {addOpen ? 'Zavřít vyhledávání' : 'Přidat knihu'}
                  </Button>
                </div>
                {addOpen && (
                  <div className="mt-2">
                    <CategoryBookSearch
                      excludedBookIds={highlighted.map((b) => b.id)}
                      onAdd={handleAdd}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteCategory && (
        <AlertDialog open={!!deleteCategory} onOpenChange={(open) => { if (!open) setDeleteCategory(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Smazat kategorii?</AlertDialogTitle>
              <AlertDialogDescription>
                Kategorie <strong>{deleteCategory.name}</strong> bude smazána. Knihy v ní zůstanou v knihovně, jen přestanou být ve výběru.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
                disabled={deleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleting ? <Spinner className="size-4 mr-2" /> : <Trash2 className="size-4 mr-2" />}
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
