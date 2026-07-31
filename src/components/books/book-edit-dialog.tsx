'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import { BookEditForm } from './book-edit-form';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookEditDialogProps {
  book: BookWithProfiles;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the updated book after a successful save. */
  onSaved: (book: BookWithProfiles) => void;
}

export function BookEditDialog({ book, open, onOpenChange, onSaved }: BookEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upravit knihu</DialogTitle>
          <DialogDescription>Uprav údaje o knize</DialogDescription>
        </DialogHeader>
        <BookEditForm
          book={book}
          onSaved={(saved) => {
            onSaved(saved);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
