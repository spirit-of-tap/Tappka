import type { Profile } from '@/lib/auth-helpers';
import type { Database } from '@/lib/supabase/database.types';
import type { Tables } from '@/lib/supabase/tables';

export type BookListStatus = Database['public']['Enums']['book_list_status'];
export type BookSource = Database['public']['Enums']['book_source'];
export type HighlightCategory = Database['public']['Enums']['highlight_category'];

export type Book = Tables<'books'>;
export type BookHighlight = Tables<'book_highlights'>;

export interface BookWithProfiles extends Book {
  created_by: Pick<Profile, 'id' | 'name' | 'picture'> | null;
  list_status_changed_by: Pick<Profile, 'id' | 'name'> | null;
  essay_count: number;
  /** Tag names derived from `book_tags` → `tags` join. */
  tags: string[];
  /** Present when the book is one of the highlighted 50. */
  highlight?: BookHighlight | null;
}

export interface BookFilters {
  listStatus?: BookListStatus;
  /** When set, filters to any of these list statuses (takes precedence over `listStatus`). */
  listStatuses?: BookListStatus[];
  search?: string;
  tags?: string[];
  createdBy?: string;
  sortBy?: 'popular' | 'recent';
  page?: number;
  pageSize?: number;
  libraryOnly?: boolean;
}

export interface CreateBookInput {
  title: string;
  author: string;
  isbn_13?: string;
  description?: string;
  google_books_cover_url?: string;
  tags?: string[];
  source: BookSource;
  external_id?: string;
}

/** Classification of a book into a list by a coach. */
export interface ClassifyBookInput {
  list_status: BookListStatus;
  book_points?: 1 | 2 | 3 | null;
  status_reason?: string | null;
}

/** Upsert payload for the highlighted-50 management. */
export interface SetBookHighlightInput {
  category: HighlightCategory;
  description?: string | null;
  /** true upserts, false deletes the highlight row */
  highlighted: boolean;
}

export interface ExternalBookCandidate {
  title: string;
  author: string;
  isbn_13: string | null;
  description: string | null;
  cover_url: string | null;
  source: BookSource;
  external_id: string;
}

export const BOOK_STATUS_LABELS: Record<BookListStatus, string> = {
  processing: 'Zpracovává se',
  shortlist: 'Shortlist',
  longlist: 'Longlist',
  archived: 'Archivováno',
};

export const BOOK_STATUS_COLORS: Record<BookListStatus, string> = {
  processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  shortlist: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  longlist: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  archived: 'bg-muted text-muted-foreground',
};

export const HIGHLIGHT_CATEGORY_LABELS: Record<HighlightCategory, string> = {
  ja: 'Já',
  my: 'My',
  oni: 'Oni',
  system: 'Systém',
};

export const BOOK_CATEGORIES = [
  'Finance & ekonomika',
  'Inovace & kreativita',
  'Komunikace & prodej',
  'Leadership',
  'Management',
  'Marketing',
  'Multidisciplinární',
  'Osobní rozvoj',
] as const;

export const BOOK_CATEGORY_LABELS: Record<string, string> = {
  'Finance & ekonomika': 'Finance & ekonomika',
  'Inovace & kreativita': 'Inovace & kreativita',
  'Komunikace & prodej': 'Komunikace & prodej',
  Leadership: 'Leadership',
  Management: 'Management',
  Marketing: 'Marketing',
  Multidisciplinární: 'Multidisciplinární',
  'Osobní rozvoj': 'Osobní rozvoj',
};

export const BOOK_POINTS_GOAL = 120;
export const BOOK_POINTS_PER_YEAR = 40;
export const DEFAULT_PAGE_SIZE = 20;
