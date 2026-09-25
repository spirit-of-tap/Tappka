import type { Profile } from '@/lib/auth-helpers';
import type { Book, HighlightCategory } from '@/lib/books/types';
import type { ContentSource } from '@/lib/content-sources/types';

/**
 * Application-facing essay shape. Title/content come from the latest valid
 * `essay_revisions` row; vote/view/comment counts are aggregated embeds.
 */
export interface Essay {
  id: string;
  author_profile_id: string;
  book_id: string | null;
  /** Points frozen from the old system for pre-2026-09-03 essays; null uses the book's live book_points. */
  frozen_book_points: string | null;
  content_source_id: string | null;
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
  author: Pick<Profile, 'id' | 'name' | 'picture' | 'role' | 'team_id'> | null;
  book: (Pick<Book, 'id' | 'title_cs' | 'author' | 'book_points' | 'list_status' | 'is_rocket_model' | 'google_books_cover_url'> & {
    highlight_category: HighlightCategory | null;
  }) | null;
  content_source: Pick<ContentSource, 'id' | 'kind' | 'title' | 'creator' | 'points' | 'status'> | null;
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

export interface EssayEngagementProfile {
  id: string;
  name: string | null;
  picture: string | null;
  role: 'student' | 'mentor' | 'coach' | 'admin';
  team: { id: string; name: string } | null;
}

export interface EssayViewerItem {
  viewer_profile_id: string;
  first_viewed_at: string;
  last_viewed_at: string;
  viewer: EssayEngagementProfile | null;
}

export interface EssayVoterItem {
  voter_profile_id: string;
  created_at: string;
  voter: EssayEngagementProfile | null;
}

export interface EssayActivityData {
  isAuthor: boolean;
  views: EssayViewerItem[];
  votes: EssayVoterItem[];
}

export interface EssayCoachRead {
  essay_id: string;
  coach_profile_id: string;
  read_at: string;
}

export interface EssayCoachReadWithProfile extends EssayCoachRead {
  coach: Pick<Profile, 'id' | 'name' | 'picture' | 'role'> | null;
}

/** Essay shown in the coach review inbox; `read_at` is set on the "read" tab. */
export interface CoachReviewEssay extends EssayWithDetails {
  read_at: string | null;
}

export const COACH_REVIEW_TABS = ['unread', 'read'] as const;
export const COACH_REVIEW_ROCKET_FILTERS = ['all', 'rocket', 'non-rocket'] as const;
export const COACH_REVIEW_POINTS_FILTERS = ['all', '1', '2', '3', '0'] as const;
export const COACH_REVIEW_REPLY_FILTERS = [
  'all',
  'with-reply',
  'without-reply',
  'edited-after-comment',
  'no-coach-comment',
] as const;

export type CoachReviewTab = (typeof COACH_REVIEW_TABS)[number];
export type CoachReviewRocketFilter = (typeof COACH_REVIEW_ROCKET_FILTERS)[number];
export type CoachReviewPointsFilter = (typeof COACH_REVIEW_POINTS_FILTERS)[number];
export type CoachReviewReplyFilter = (typeof COACH_REVIEW_REPLY_FILTERS)[number];

export interface CoachReviewFilters {
  tab?: CoachReviewTab;
  teamId?: string | null;
  rocket?: CoachReviewRocketFilter;
  points?: CoachReviewPointsFilter;
  reply?: CoachReviewReplyFilter;
  /** Case-insensitive substring of student name, essay title, book title (cs/en) / author or source title / creator. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CoachReviewResult {
  essays: CoachReviewEssay[];
  totalCount: number;
  unreadCount: number;
  readCount: number;
  hasMore: boolean;
  commentsMap: Record<string, EssayCommentWithAuthor[]>;
  coachReadsMap: Record<string, EssayCoachReadWithProfile[]>;
}

export interface EssayRevisionSummary {
  revision_no: number;
  title: string;
  created_at: string;
  updated_at: string;
  word_count: number;
  snippet: string;
}

export type EssayListView = 'moje' | 'tym' | 'vse';

export type EssaySortOrder = 'recent' | 'month' | 'best';

export interface EssayFilters {
  view?: EssayListView;
  authorProfileId?: string;
  teamId?: string;
  bookId?: string;
  contentSourceId?: string;
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
  content_source_id?: string;
}

export interface UpdateEssayInput {
  title?: string;
  content_json?: object;
  content_text?: string;
  book_id?: string | null;
  content_source_id?: string | null;
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
