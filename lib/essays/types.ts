import type { Profile } from '@/lib/auth-helpers';
import type { Book } from '@/lib/books/types';

export interface Essay {
  id: string;
  author_profile_id: string;
  book_id: string | null;
  title: string;
  content_json: object;
  content_text: string;
  published: boolean;
  view_count: number;
  vote_count: number;
  created_at: string;
  updated_at: string;
}

export interface EssayWithDetails extends Essay {
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role'> | null;
  book: Pick<Book, 'id' | 'title' | 'author' | 'book_points' | 'status' | 'cover_path'> | null;
  comment_count: number;
}

export interface EssayComment {
  id: string;
  essay_id: string;
  author_profile_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface EssayCommentWithAuthor extends EssayComment {
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role'> | null;
}

export interface EssayView {
  essay_id: string;
  viewer_profile_id: string;
  first_viewed_at: string;
  last_viewed_at: string;
}

export interface EssayViewWithProfile extends EssayView {
  viewer: Pick<Profile, 'id' | 'name' | 'role'> | null;
}

export interface EssayCoachRead {
  essay_id: string;
  coach_profile_id: string;
  read_at: string;
}

export interface EssayCoachReadWithProfile extends EssayCoachRead {
  coach: Pick<Profile, 'id' | 'name' | 'role'> | null;
}

/** Essay shown in the coach review inbox; `read_at` is set on the "read" tab. */
export interface CoachReviewEssay extends EssayWithDetails {
  read_at: string | null;
}

export type EssayListView = 'moje' | 'tym' | 'vse';

export type EssaySortOrder = 'recent' | 'week' | 'best';

export interface EssayFilters {
  view?: EssayListView;
  authorProfileId?: string;
  teamId?: string;
  bookId?: string;
  search?: string;
  tag?: string;
  sort?: EssaySortOrder;
  page?: number;
  pageSize?: number;
}

export interface CreateEssayInput {
  title: string;
  content_json: object;
  content_text: string;
  book_id?: string;
}

export interface UpdateEssayInput {
  title?: string;
  content_json?: object;
  content_text?: string;
  book_id?: string | null;
}

export const ESSAY_LIST_VIEW_LABELS: Record<EssayListView, string> = {
  moje: 'Moje',
  tym: 'Tým',
  vse: 'Celá škola',
};
