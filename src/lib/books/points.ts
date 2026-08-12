// Book points are stored in a numeric column (legacy scoring used fractional
// values such as 0.33). PostgREST returns numeric as a string, so always coerce
// before comparing or rendering.

export function pointsNumber(p: number | string | null | undefined): number {
  const n = Number(p ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Render points with a Czech decimal comma; whole numbers stay without decimals. */
export function formatPoints(p: number | string | null | undefined): string {
  const n = pointsNumber(p);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

export function pointsLabel(p: number | string | null | undefined): string {
  const n = pointsNumber(p);
  if (n === 1) return 'bod';
  if (n >= 2 && n <= 4) return 'body';
  return 'bodů';
}

export function formatPointsWithLabel(p: number | string | null | undefined): string {
  return `${formatPoints(p)} ${pointsLabel(p)}`;
}

/**
 * A coach's verdict on a pending book. The score *is* the decision: 0 rejects the
 * book into the archive, 1–3 approve it into the longlist. The classify route
 * already encodes the same rule — it forces `book_points: 0` on `archived` and
 * refuses anything outside 1–3 on every other list.
 */
export const REVIEW_POINT_VALUES = [0, 1, 2, 3] as const;

export type ReviewPoints = (typeof REVIEW_POINT_VALUES)[number];

/** Points valid for a book that stays on a list — moving between lists never rejects. */
export const COACH_POINT_VALUES = [1, 2, 3] as const;

export type CoachPoints = (typeof COACH_POINT_VALUES)[number];

/**
 * The AI's stored suggestion as a reviewable verdict, or `null` when nothing
 * scored the book — a manually filled entry has no suggestion to confirm, and
 * pretending it suggested 1 would put words in the AI's mouth.
 *
 * A stored 0 stays 0: the rubric's Výjimka C/D use it to mean "reject", and
 * rounding it up to 1 would silently flip a refusal into an approval.
 */
export function suggestedReviewPoints(
  p: number | string | null | undefined,
): ReviewPoints | null {
  if (p === null || p === undefined || p === '') return null;
  const n = Math.round(pointsNumber(p));
  if (n <= 0) return 0;
  if (n >= 3) return 3;
  return n as ReviewPoints;
}

/**
 * Opening value for a list move, where 0 is not on the table — the target list is
 * already chosen and the classify route rejects 0 for anything but `archived`.
 */
export function suggestedBookPoints(p: number | string | null | undefined): CoachPoints {
  const n = Math.round(pointsNumber(p));
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}
