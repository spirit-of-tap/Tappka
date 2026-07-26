import type { Profile } from '@/lib/auth-helpers';
import type { Database } from '@/lib/supabase/database.types';
import type { Tables } from '@/lib/supabase/tables';

export type BookStatus = Database['public']['Enums']['book_status'];
export type BookSource = Database['public']['Enums']['book_source'];

export type Book = Tables<'books'>;

export interface BookWithProfiles extends Book {
  created_by: Pick<Profile, 'id' | 'name' | 'picture'> | null;
  status_changed_by: Pick<Profile, 'id' | 'name'> | null;
  essay_count: number;
  /** Tag names derived from `book_tags` → `tags` join. */
  tags: string[];
}

export type BookComment = Tables<'book_comments'>;

export interface BookCommentWithAuthor extends BookComment {
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role'> | null;
}

export interface BookFilters {
  status?: BookStatus;
  search?: string;
  tags?: string[];
  createdBy?: string;
  sortBy?: 'popular' | 'recent';
  page?: number;
  pageSize?: number;
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

export interface ApproveBookInput {
  book_points: 1 | 2 | 3;
}

export interface RejectBookInput {
  status_reason: string;
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

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  pending: 'Čeká na schválení',
  approved: 'Schváleno',
  rejected: 'Zamítnuto',
};

export const BOOK_STATUS_COLORS: Record<BookStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
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
