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

/** The only values a coach may assign on review — the classify route rejects anything else. */
export const COACH_POINT_VALUES = [1, 2, 3] as const;

export type CoachPoints = (typeof COACH_POINT_VALUES)[number];

/**
 * Opening value for a coach's points picker: the AI's stored suggestion rounded
 * into the 1–3 range the classify route accepts. Falls back to 1 for books that
 * arrived without a score (manual entry) or were scored 0.
 */
export function suggestedBookPoints(p: number | string | null | undefined): CoachPoints {
  const n = Math.round(pointsNumber(p));
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}
