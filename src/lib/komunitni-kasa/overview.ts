import { formatCzk, type BalancePoint } from "./stats";
import type { AnnotatedTransaction } from "./summary";

export const MEMBER_CONTRIBUTION_CZK = 190;
export const TREND_WINDOW_MONTHS = 12;

const monthFormatter = new Intl.DateTimeFormat("cs-CZ", { month: "long", year: "numeric" });

export interface DirectionTotal {
  sum: number;
  count: number;
}

export interface YearTotals {
  income: DirectionTotal;
  expense: DirectionTotal;
}

/** Součet příjmů a výdajů (výdaje v absolutní hodnotě) za kalendářní rok. */
export function computeYearTotals(items: AnnotatedTransaction[], year: number): YearTotals {
  const totals: YearTotals = { income: { sum: 0, count: 0 }, expense: { sum: 0, count: 0 } };
  for (const item of items) {
    if (item.date.getFullYear() !== year || item.amount === 0) continue;
    const bucket = item.amount > 0 ? totals.income : totals.expense;
    bucket.sum += Math.abs(item.amount);
    bucket.count += 1;
  }
  return totals;
}

export interface MonthGroup {
  key: string;
  label: string;
  items: AnnotatedTransaction[];
}

/** Pohyby seskupené po měsících v pořadí, v jakém přišly (od nejnovějšího). */
export function groupByMonth(items: AnnotatedTransaction[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const key = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, "0")}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: monthFormatter.format(item.date), items: [item] });
  }
  return groups;
}

export interface TrendWindow {
  points: BalancePoint[];
  periodLabel: string;
  summary: string;
}

/**
 * Posledních 12 měsíců vývoje zůstatku (včetně aktuálního). Vrací null, pokud
 * v okně nejsou aspoň dva body — graf pak nemá co ukázat.
 */
export function computeTrendWindow(trend: BalancePoint[], now: Date): TrendWindow | null {
  const start = new Date(now.getFullYear(), now.getMonth() - (TREND_WINDOW_MONTHS - 1), 1).getTime();
  const points = trend.filter((p) => p.time >= start);
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const periodLabel = `${monthFormatter.format(new Date(first.time))} – ${monthFormatter.format(new Date(last.time))}`;
  const from = formatCzk(first.balance);
  const to = formatCzk(last.balance);
  const verb = last.balance > first.balance ? "vzrostl" : last.balance < first.balance ? "klesl" : "zůstal stejný";
  const summary =
    last.balance === first.balance
      ? `Za ${TREND_WINDOW_MONTHS} měsíců zůstatek zůstal stejný: ${to}`
      : `Za ${TREND_WINDOW_MONTHS} měsíců zůstatek ${verb} z ${from} na ${to}`;
  return { points, periodLabel, summary };
}
