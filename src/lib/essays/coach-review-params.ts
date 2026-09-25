import {
  COACH_REVIEW_POINTS_FILTERS,
  COACH_REVIEW_REPLY_FILTERS,
  COACH_REVIEW_ROCKET_FILTERS,
  COACH_REVIEW_TABS,
} from '@/lib/essays/types';
import type {
  CoachReviewPointsFilter,
  CoachReviewReplyFilter,
  CoachReviewRocketFilter,
  CoachReviewTab,
} from '@/lib/essays/types';

/** URL query keys shared by the "Ke kontrole" page, its client list and the API route. */
export const COACH_REVIEW_PARAM = {
  tab: 'tab',
  team: 'team_id',
  rocket: 'rocket',
  points: 'points',
  reply: 'reply',
  search: 'q',
  page: 'page',
  pageSize: 'page_size',
} as const;

/** Team filter value meaning "all teams". */
export const ALL_TEAMS = 'all';
export const COACH_REVIEW_MAX_PAGE_SIZE = 100;
export const COACH_REVIEW_DEFAULT_PAGE_SIZE = 50;
export const COACH_REVIEW_SEARCH_MAX_LENGTH = 100;

export interface CoachReviewParams {
  tab: CoachReviewTab;
  /** Team id or ALL_TEAMS. */
  team: string;
  rocket: CoachReviewRocketFilter;
  points: CoachReviewPointsFilter;
  reply: CoachReviewReplyFilter;
  search: string;
  page: number;
  pageSize: number;
  /** True when any filter (not tab/paging) was set explicitly in the URL. */
  hasExplicitFilters: boolean;
}

function pick<T extends string>(allowed: readonly T[], value: string | undefined, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function toPositiveInt(value: string | undefined, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** Validates coach review query params; invalid values fall back to defaults. */
export function parseCoachReviewParams(
  get: (key: string) => string | null | undefined,
  defaultTeam: string,
): CoachReviewParams {
  const read = (key: string) => get(key) ?? undefined;
  const filterKeys = [
    COACH_REVIEW_PARAM.team,
    COACH_REVIEW_PARAM.rocket,
    COACH_REVIEW_PARAM.points,
    COACH_REVIEW_PARAM.reply,
    COACH_REVIEW_PARAM.search,
  ];
  return {
    tab: pick(COACH_REVIEW_TABS, read(COACH_REVIEW_PARAM.tab), 'unread'),
    team: read(COACH_REVIEW_PARAM.team) || defaultTeam,
    rocket: pick(COACH_REVIEW_ROCKET_FILTERS, read(COACH_REVIEW_PARAM.rocket), 'all'),
    points: pick(COACH_REVIEW_POINTS_FILTERS, read(COACH_REVIEW_PARAM.points), 'all'),
    reply: pick(COACH_REVIEW_REPLY_FILTERS, read(COACH_REVIEW_PARAM.reply), 'all'),
    search: (read(COACH_REVIEW_PARAM.search) ?? '').trim().slice(0, COACH_REVIEW_SEARCH_MAX_LENGTH),
    page: toPositiveInt(read(COACH_REVIEW_PARAM.page), 1, Number.MAX_SAFE_INTEGER),
    pageSize: toPositiveInt(
      read(COACH_REVIEW_PARAM.pageSize),
      COACH_REVIEW_DEFAULT_PAGE_SIZE,
      COACH_REVIEW_MAX_PAGE_SIZE,
    ),
    hasExplicitFilters: filterKeys.some((key) => read(key) !== undefined),
  };
}

/** Team filter value → RPC team id (null = all teams). */
export function teamIdForQuery(team: string): string | null {
  return team === ALL_TEAMS ? null : team;
}
