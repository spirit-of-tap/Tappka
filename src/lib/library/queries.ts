import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { BookCopyStatus, BookLibraryInfo, BookLoanWithDetails, LibraryBookWithBook } from './types';
import { tagNamesFromJoin } from '@/lib/books/tags';
import type { BookWithProfiles } from '@/lib/books/types';

interface BookQueryRow extends Omit<BookWithProfiles, 'tags' | 'essay_count'> {
  essay_count?: number;
  book_tags?: { tags: { name: string } | null }[] | null;
}

function mapBookRow(row: BookQueryRow): BookWithProfiles {
  const { book_tags, essay_count, ...rest } = row;
  return {
    ...rest,
    tags: tagNamesFromJoin(book_tags),
    essay_count: essay_count ?? 0,
  };
}

const BOOK_SELECT = `
  *,
  book:books!inner(
    *,
    created_by:profiles!created_by_profile_id(id, name, picture),
    list_status_changed_by:profiles!list_status_changed_by_profile_id(id, name),
    book_tags(tags(name))
  )
`;

export async function getLibraryBooks(
  supabase: SupabaseClient<Database>,
  options?: { bookId?: string; page?: number; pageSize?: number },
): Promise<LibraryBookWithBook[]> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('library_books')
    .select(BOOK_SELECT)
    .range(from, to);

  if (options?.bookId) {
    query = query.eq('book_id', options.bookId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as LibraryBookWithBook[]).map((lb) => ({
    ...lb,
    book: mapBookRow(lb.book as unknown as BookQueryRow),
  }));
}

export async function getBookLibraryInfo(
  supabase: SupabaseClient<Database>,
  bookId: string,
): Promise<BookLibraryInfo> {
  const { data: copies, error } = await supabase
    .from('library_books')
    .select('id')
    .eq('book_id', bookId);

  if (error) throw error;

  const totalCopies = copies?.length ?? 0;

  if (totalCopies === 0) {
    return { totalCopies: 0, availableCopies: 0, inLibrary: false };
  }

  const copyIds = copies?.map((c: { id: string }) => c.id) ?? [];

  const { data: activeLoans, error: loanError } = await supabase
    .from('book_loans')
    .select('library_book_id')
    .in('library_book_id', copyIds)
    .is('returned_at', null);

  if (loanError) throw loanError;

  const borrowedCopyIds = new Set(activeLoans?.map((l: { library_book_id: string }) => l.library_book_id) ?? []);

  const totalBorrowed = borrowedCopyIds.size;
  const availableCopies = totalCopies - totalBorrowed;

  return {
    totalCopies,
    availableCopies,
    inLibrary: totalCopies > 0,
  };
}

export async function getBookCopiesStatus(
  supabase: SupabaseClient<Database>,
  bookId: string,
): Promise<BookCopyStatus[]> {
  const { data: copies, error } = await supabase
    .from('library_books')
    .select('id, created_at')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!copies?.length) return [];

  const copyIds = copies.map((c: { id: string }) => c.id);

  const { data: activeLoans, error: loanError } = await supabase
    .from('book_loans')
    .select('library_book_id, due_at, borrower:profiles!borrower_id(id, name, picture)')
    .in('library_book_id', copyIds)
    .is('returned_at', null);

  if (loanError) throw loanError;

  const loanByCopyId = new Map(
    (activeLoans ?? []).map((loan) => [loan.library_book_id, loan]),
  );

  const now = new Date();

  return copies.map((copy: { id: string }) => {
    const loan = loanByCopyId.get(copy.id);
    if (!loan) {
      return { id: copy.id, borrower: null, dueAt: null, isOverdue: false };
    }
    return {
      id: copy.id,
      borrower: loan.borrower as unknown as { id: string; name: string | null; picture: string | null },
      dueAt: loan.due_at,
      isOverdue: new Date(loan.due_at) < now,
    };
  });
}

export async function getBooksWithLibraryInfo(
  supabase: SupabaseClient<Database>,
  bookIds: string[],
): Promise<Map<string, BookLibraryInfo>> {
  if (bookIds.length === 0) return new Map();

  const { data: copies, error } = await supabase
    .from('library_books')
    .select('id, book_id')
    .in('book_id', bookIds);

  if (error) throw error;

  const copiesByBook = new Map<string, string[]>();
  for (const c of copies ?? []) {
    const arr = copiesByBook.get(c.book_id) ?? [];
    arr.push(c.id);
    copiesByBook.set(c.book_id, arr);
  }

  if (copiesByBook.size === 0) return new Map();

  const allCopyIds = [...copiesByBook.values()].flat();

  const { data: activeLoans, error: loanError } = await supabase
    .from('book_loans')
    .select('library_book_id')
    .in('library_book_id', allCopyIds)
    .is('returned_at', null);

  if (loanError) throw loanError;

  const borrowedCopyIds = new Set(activeLoans?.map((l: { library_book_id: string }) => l.library_book_id) ?? []);

  const result = new Map<string, BookLibraryInfo>();

  for (const [bookId, copyIds] of copiesByBook) {
    const totalCopies = copyIds.length;
    const borrowedCount = copyIds.filter((id) => borrowedCopyIds.has(id)).length;
    result.set(bookId, {
      totalCopies,
      availableCopies: totalCopies - borrowedCount,
      inLibrary: totalCopies > 0,
    });
  }

  return result;
}

export async function getUserActiveLoanForBook(
  supabase: SupabaseClient<Database>,
  profileId: string,
  bookId: string,
): Promise<string | null> {
  const loan = await getUserActiveLoanDetails(supabase, profileId, bookId);
  return loan?.id ?? null;
}

export async function getUserActiveLoanDetails(
  supabase: SupabaseClient<Database>,
  profileId: string,
  bookId: string,
): Promise<{ id: string; due_at: string } | null> {
  const { data: copies, error: copiesError } = await supabase
    .from('library_books')
    .select('id')
    .eq('book_id', bookId);

  if (copiesError) throw copiesError;
  if (!copies?.length) return null;

  const copyIds = copies.map((c: { id: string }) => c.id);

  const { data: loan, error: loanError } = await supabase
    .from('book_loans')
    .select('id, due_at')
    .in('library_book_id', copyIds)
    .eq('borrower_id', profileId)
    .is('returned_at', null)
    .maybeSingle();

  if (loanError) throw loanError;
  return loan;
}

export async function getMyLoans(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<BookLoanWithDetails[]> {
  const { data, error } = await supabase
    .from('book_loans')
    .select(`
      *,
      library_book:library_books!inner(
        *,
        book:books!inner(
          *,
          created_by:profiles!created_by_profile_id(id, name, picture),
          list_status_changed_by:profiles!list_status_changed_by_profile_id(id, name),
          book_tags(tags(name))
        )
      )
    `)
    .eq('borrower_id', profileId)
    .order('borrowed_at', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as BookLoanWithDetails[]).map((loan) => ({
    ...loan,
    library_book: {
      ...loan.library_book,
      book: mapBookRow(loan.library_book.book as unknown as BookQueryRow),
    },
  }));
}

export async function getAvailableCopyForBook(
  supabase: SupabaseClient<Database>,
  bookId: string,
): Promise<string | null> {
  const { data: copies, error: copiesError } = await supabase
    .from('library_books')
    .select('id')
    .eq('book_id', bookId);

  if (copiesError) throw copiesError;
  if (!copies?.length) return null;

  const copyIds = copies.map((c: { id: string }) => c.id);

  const { data: activeLoans, error: loanError } = await supabase
    .from('book_loans')
    .select('library_book_id')
    .in('library_book_id', copyIds)
    .is('returned_at', null);

  if (loanError) throw loanError;

  const borrowedIds = new Set(activeLoans?.map((l: { library_book_id: string }) => l.library_book_id) ?? []);

  const available = copyIds.find((id) => !borrowedIds.has(id));
  return available ?? null;
}

export async function findOrCreateLibraryCopy(
  supabase: SupabaseClient<Database>,
  bookId: string,
  isbn13: string | null,
  profileId: string,
): Promise<string> {
  const { data: existing, error: searchError } = await supabase
    .from('library_books')
    .select('id')
    .eq('book_id', bookId)
    .maybeSingle();

  if (searchError) throw searchError;

  if (existing) return existing.id;

  const { data: inserted, error: insertError } = await supabase
    .from('library_books')
    .insert({
      book_id: bookId,
      isbn_13: isbn13,
      created_by_profile_id: profileId,
      updated_by_profile_id: profileId,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return inserted.id;
}
