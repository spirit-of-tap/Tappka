import type { Profile } from '@/lib/auth-helpers';

export type BookStatus = 'pending' | 'approved' | 'rejected';
export type BookSource = 'manual' | 'google_books' | 'open_library';

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn_13: string | null;
  description: string | null;
  cover_path: string | null;
  tags: string[];
  suggested_points: number;
  book_points: number;
  ai_book_points: number | null;
  legacy_book_points: number | null;
  ai_reason: string | null;
  status: BookStatus;
  added_by_profile_id: string;
  approved_by_profile_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  source: BookSource;
  external_id: string | null;
  page_count: number | null;
  preview_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookWithProfiles extends Book {
  added_by: Pick<Profile, 'id' | 'name' | 'picture'> | null;
  approved_by: Pick<Profile, 'id' | 'name'> | null;
  essay_count: number;
}

export interface BookComment {
  id: string;
  book_id: string;
  author_profile_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface BookCommentWithAuthor extends BookComment {
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role'> | null;
}

export interface BookFilters {
  status?: BookStatus;
  search?: string;
  tags?: string[];
  addedBy?: string;
  sortBy?: 'popular' | 'recent';
  page?: number;
  pageSize?: number;
}

export interface CreateBookInput {
  title: string;
  author: string;
  isbn_13?: string;
  description?: string;
  cover_path?: string;
  tags?: string[];
  suggested_points: number;
  source: BookSource;
  external_id?: string;
}

export interface ApproveBookInput {
  book_points: 1 | 2 | 3;
}

export interface RejectBookInput {
  rejection_reason: string;
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
  'podnikani',
  'uceni',
  'managment',
  'duchovni_rust',
  'vedeni',
  'spolecnost',
  'inovace',
  'koucovani',
  'marketing',
  'Leadership',
  'Finance',
] as const;

export const BOOK_CATEGORY_LABELS: Record<string, string> = {
  podnikani: 'Podnikání',
  uceni: 'Učení',
  managment: 'Management',
  duchovni_rust: 'Duchovní růst',
  vedeni: 'Vedení',
  spolecnost: 'Společnost',
  inovace: 'Inovace',
  koucovani: 'Koučování',
  marketing: 'Marketing',
  Leadership: 'Leadership',
  Finance: 'Finance',
};

export const BOOK_POINTS_GOAL = 120;
export const BOOK_POINTS_PER_YEAR = 40;
export const DEFAULT_PAGE_SIZE = 20;
