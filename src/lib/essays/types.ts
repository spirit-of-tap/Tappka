import type { Profile } from '@/lib/auth-helpers';
import type { Book, HighlightCategory } from '@/lib/books/types';

/**
 * Application-facing essay shape. Title/content come from the latest valid
 * `essay_revisions` row; vote/view/comment counts are aggregated embeds.
 */
export interface Essay {
  id: string;
  author_profile_id: string;
  book_id: string | null;
  title: string;
  content_json: object;
  /** Plain text derived from `content_json` for snippets (not stored). */
  content_text: string;
  published_at: string | null;
  view_count: number;
  vote_count: number;
  created_at: string;
  updated_at: string;
  pinned_at: string | null;
  pinned_by_profile_id: string | null;
  removed_at: string | null;
}

export interface EssayWithDetails extends Essay {
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role'> | null;
  book: (Pick<Book, 'id' | 'title_cs' | 'author' | 'book_points' | 'list_status' | 'is_rocket_model' | 'google_books_cover_url'> & {
    highlight_category: HighlightCategory | null;
  }) | null;
  comment_count: number;
}

export interface EssayComment {
  id: string;
  essay_id: string;
  author_profile_id: string;
  parent_id: string | null;
  body: string;
  removed_at: string | null;
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

export type EssaySortOrder = 'recent' | 'month' | 'best';

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
  content_text?: string;
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

/** Whether an essay is currently pinned. */
export function isEssayPinned(essay: Pick<Essay, 'pinned_at'>): boolean {
  return essay.pinned_at != null;
}
