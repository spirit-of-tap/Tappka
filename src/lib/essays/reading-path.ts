import { POINTS_ELIGIBLE_LIST_STATUSES } from '@/lib/books/types';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import type { EssayWithDetails } from '@/lib/essays/types';
import { pluralizeCz } from '@/lib/utils/pluralize-cz';

export const MAX_LABELED_MILESTONES = 4;
export const MIN_LABEL_GAP_PERCENT = 22;
const LABEL_EDGE_PERCENT = 12;
const FULL_PERCENT = 100;
const LAST_WINTER_MONTH = 1;
const FIRST_WINTER_MONTH = 9;
const LAST_SUMMER_MONTH = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ELIGIBLE_LIST_STATUSES = new Set<string>(POINTS_ELIGIBLE_LIST_STATUSES);

export interface PathMilestone {
  id: string;
  title: string;
  points: number;
  cumulative: number;
  /** 0-100, share of the goal reached once this essay is counted. */
  position: number;
}

export type LabelAlign = 'start' | 'center' | 'end';

interface CreditedEssay {
  essay: EssayWithDetails;
  title: string;
  points: number;
  earnedAt: string;
}

/**
 * Essays that earned approved points, in the order they were published, using
 * the same one-credit-per-book rule as `getUserBookPointsStats` (earliest essay
 * wins; frozen legacy credit counts per essay).
 */
export function buildPathMilestones(essays: EssayWithDetails[], goal: number): PathMilestone[] {
  const credits = new Map<string, CreditedEssay>();

  for (const essay of essays) {
    if (!essay.published_at || essay.removed_at) continue;
    const source = getEssaySourceDisplay(essay);
    if (source.points <= 0) continue;

    let key: string;
    if (source.isFrozen) key = `frozen:${essay.id}`;
    else if (essay.book && ELIGIBLE_LIST_STATUSES.has(essay.book.list_status)) key = `book:${essay.book.id}`;
    else if (essay.content_source?.status === 'approved') key = `source:${essay.content_source.id}`;
    else continue;

    const existing = credits.get(key);
    if (existing && existing.earnedAt <= essay.published_at) continue;
    credits.set(key, {
      essay,
      title: source.title ?? essay.title,
      points: source.points,
      earnedAt: essay.published_at,
    });
  }

  const ordered = [...credits.values()].sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
  let cumulative = 0;
  return ordered.map(({ essay, title, points }) => {
    cumulative += points;
    return {
      id: essay.id,
      title,
      points,
      cumulative,
      position: pathPosition(cumulative, goal),
    };
  });
}

export function pathPosition(points: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(FULL_PERCENT, Math.max(0, (points / goal) * FULL_PERCENT));
}

/**
 * Indexes of milestones that get a visible label. Walks from the latest one
 * (the most relevant) and keeps a label only when it clears the previous
 * label, up to a fixed number; the rest stay in the screen-reader list.
 */
export function pickLabeledMilestones(positions: number[]): Set<number> {
  const labeled = new Set<number>();
  let lastLabelPosition: number | null = null;
  for (let i = positions.length - 1; i >= 0 && labeled.size < MAX_LABELED_MILESTONES; i--) {
    if (lastLabelPosition !== null && lastLabelPosition - positions[i] < MIN_LABEL_GAP_PERCENT) continue;
    labeled.add(i);
    lastLabelPosition = positions[i];
  }
  return labeled;
}

export function labelAlign(position: number): LabelAlign {
  if (position < LABEL_EDGE_PERCENT) return 'start';
  if (position > FULL_PERCENT - LABEL_EDGE_PERCENT) return 'end';
  return 'center';
}

export interface PendingMarker {
  count: number;
  position: number;
  /** False when the label would sit on top of the goal label. */
  showLabel: boolean;
}

export interface ReadingPath {
  fillPercent: number;
  goalReached: boolean;
  pending: PendingMarker | null;
}

/**
 * Pending books are not scored yet, so the marker assumes the minimum of one
 * point each and sits right after the filled part of the track.
 */
export function buildReadingPath(approved: number, pending: number, goal: number): ReadingPath {
  const fillPercent = pathPosition(approved, goal);
  const goalReached = goal > 0 && approved >= goal;
  if (pending <= 0 || goalReached) return { fillPercent, goalReached, pending: null };
  const position = pathPosition(approved + pending, goal);
  return {
    fillPercent,
    goalReached,
    pending: {
      count: pending,
      position,
      showLabel: FULL_PERCENT - position >= MIN_LABEL_GAP_PERCENT,
    },
  };
}

/** Days until the last day of the current study semester (winter Sep-Jan, summer Feb-Aug). */
export function daysLeftInSemester(now: Date): number {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const lastDay =
    month >= FIRST_WINTER_MONTH
      ? new Date(year + 1, LAST_WINTER_MONTH, 0)
      : month <= LAST_WINTER_MONTH
        ? new Date(year, LAST_WINTER_MONTH, 0)
        : new Date(year, LAST_SUMMER_MONTH, 0);
  const today = new Date(year, now.getMonth(), now.getDate());
  return Math.round((lastDay.getTime() - today.getTime()) / MS_PER_DAY);
}

export function daysLeftLabel(days: number): string {
  if (days <= 0) return 'poslední den semestru';
  const verb = days >= 2 && days <= 4 ? 'zbývají' : 'zbývá';
  return `${verb} ${days} ${pluralizeCz(days, ['den', 'dny', 'dní'])}`;
}

export interface ReadingStatsSummary {
  essay_count: number;
  pending_points: number;
}

export function readingSummary({ essay_count, pending_points }: ReadingStatsSummary): string {
  const essays =
    essay_count === 0
      ? 'Zatím žádné eseje'
      : `${essay_count} ${pluralizeCz(essay_count, ['esej', 'eseje', 'esejí'])}`;
  if (pending_points === 0) return essays;
  return `${essays} · ${pending_points} ${pluralizeCz(pending_points, ['kniha čeká', 'knihy čekají', 'knih čeká'])} na schválení`;
}
