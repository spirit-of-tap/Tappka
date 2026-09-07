'use client';

import { useState } from 'react';
import { ArrowRightLeft, Ellipsis, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { BookEditDialog } from './book-edit-dialog';
import { DeleteBookDialog } from './delete-book-dialog';
import { BookRowHeader } from './book-row-header';
import type { BookWithProfiles, HighlightCategory } from '@/lib/books/types';

interface CoachHighlightRowProps {
  book: BookWithProfiles;
  categories: HighlightCategory[];
  onSetHighlight: (book: BookWithProfiles, categoryId: string) => Promise<boolean>;
  onRemoveHighlight: (bookId: string) => Promise<boolean>;
  onEdited?: (book: BookWithProfiles) => void;
  onDeleted: (bookId: string) => void;
}

export function CoachHighlightRow({
  book,
  categories,
  onSetHighlight,
  onRemoveHighlight,
  onEdited,
  onDeleted,
}: CoachHighlightRowProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'delete' | 'duplicate'>('delete');

  const run = async (action: string, fn: () => Promise<boolean>) => {
    setBusyAction(action);
    try {
      const ok = await fn();
      if (!ok) setBusyAction(null);
    } catch {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <BookRowHeader book={book} coverSize="md" textClassName="flex-1" titleClassName="block truncate" />

      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => run('unhighlight', () => onRemoveHighlight(book.id))}
          disabled={busyAction !== null}
          className="gap-1"
        >
          {busyAction === 'unhighlight' ? <Spinner className="size-3" /> : <Sparkles className="size-3" />}
          Odebrat
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" disabled={busyAction !== null}>
              <Ellipsis className="size-4" />
              <span className="sr-only">Akce</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Přesunout do kategorie</DropdownMenuLabel>
            {categories.map((category) => (
              <DropdownMenuItem
                key={category.id}
                disabled={busyAction !== null || category.id === book.highlight_category?.id}
                onClick={() => run('move', () => onSetHighlight(book, category.id))}
              >
                {category.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setEditOpen(true)}
              disabled={busyAction !== null}
              className="gap-2"
            >
              <Pencil className="size-4" />
              Upravit knihu
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => run('unhighlight', () => onRemoveHighlight(book.id))}
              disabled={busyAction !== null}
              className="gap-2"
            >
              <Sparkles className="size-4" />
              Odebrat z výběru
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDeleteMode('duplicate');
                setDeleteOpen(true);
              }}
              disabled={busyAction !== null}
              className="gap-2"
            >
              <ArrowRightLeft className="size-4" />
              Označit jako duplikát…
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDeleteMode('delete');
                setDeleteOpen(true);
              }}
              disabled={busyAction !== null}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="size-4" />
              Smazat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {editOpen && (
        <BookEditDialog
          book={book}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={(updated) => {
            onEdited?.(updated);
            setEditOpen(false);
          }}
          onDeleted={onDeleted}
        />
      )}

      <DeleteBookDialog
        book={book}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        mode={deleteMode}
        onDeleted={onDeleted}
      />
    </div>
  );
}
