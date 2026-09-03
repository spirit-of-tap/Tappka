import type { Tables } from '@/lib/supabase/tables';
import type { BookWithProfiles } from '@/lib/books/types';

export type LibraryBook = Tables<'library_books'>;
export type BookLoan = Tables<'book_loans'>;

export interface LibraryBookWithBook extends LibraryBook {
  book: BookWithProfiles;
}

export interface BookLoanWithDetails extends BookLoan {
  library_book: LibraryBookWithBook;
}

export interface BookLibraryInfo {
  totalCopies: number;
  availableCopies: number;
  inLibrary: boolean;
}

export interface BookCopyStatus {
  id: string;
  borrower: { id: string; name: string | null; picture: string | null } | null;
  dueAt: string | null;
  isOverdue: boolean;
}

export interface LibraryBookResult {
  id: string;
  book_id: string;
  created_at: string;
  book: BookWithProfiles;
  totalCopies: number;
  availableCopies: number;
}
