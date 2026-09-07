'use client';

import { useRef, useState } from 'react';
import { ArrowRightLeft, RefreshCw } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { BookEditForm } from './book-edit-form';
import { ReplaceRecordFlow } from './replace-record-flow';
import { DeleteBookDialog } from './delete-book-dialog';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookEditDialogProps {
  book: BookWithProfiles;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the updated book after a successful save. */
  onSaved: (book: BookWithProfiles) => void;
  /** Called with the id of the book that was deleted or marked duplicate. */
  onDeleted?: (bookId: string) => void;
}

export function BookEditDialog({ book, open, onOpenChange, onSaved, onDeleted }: BookEditDialogProps) {
  const [replacing, setReplacing] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const replaceButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => {
        if (!next) setReplacing(false);
        onOpenChange(next);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{replacing ? 'Nahradit záznam' : 'Upravit knihu'}</DialogTitle>
            <DialogDescription>
              {replacing
                ? 'Vyhledej správnou verzi knihy a přepiš obálku, ISBN a identifikátor záznamu.'
                : 'Uprav údaje o knize'}
            </DialogDescription>
          </DialogHeader>

          <div className={replacing ? 'hidden' : undefined}>
            <BookEditForm
              book={book}
              onSaved={(saved) => {
                onSaved(saved);
                onOpenChange(false);
              }}
              onCancel={() => onOpenChange(false)}
            />
            <div className="mt-6 border-t pt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <Button
                  ref={replaceButtonRef}
                  variant="outline"
                  size="sm"
                  onClick={() => setReplacing(true)}
                  className="gap-2"
                >
                  <RefreshCw className="size-4" />
                  Nahradit záznam…
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Opraví knihu, u které byl omylem vybrán špatný záznam z Google Books.
                </p>
              </div>

              {onDeleted && (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDuplicateOpen(true)}
                    className="gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/40"
                  >
                    <ArrowRightLeft className="size-4" />
                    Označit jako duplikát…
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className={replacing ? undefined : 'hidden'}>
            <ReplaceRecordFlow
              key={String(replacing)}
              book={book}
              onBack={() => {
                setReplacing(false);
                requestAnimationFrame(() => replaceButtonRef.current?.focus());
              }}
              onReplaced={(updated) => {
                onSaved(updated);
                onOpenChange(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {duplicateOpen && (
        <DeleteBookDialog
          book={book}
          open={duplicateOpen}
          onOpenChange={setDuplicateOpen}
          mode="duplicate"
          onDeleted={(id) => {
            onDeleted?.(id);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}

