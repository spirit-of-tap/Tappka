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
