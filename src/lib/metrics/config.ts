/**
 * Single source of truth for study-goal metrics ("Nastavené metriky").
 * Pages read their goal from here — never hardcode targets in a page.
 */
export type MetricPeriod = "semester" | "year" | "study"

export interface MetricDefinition {
  label: string
  /** What one `target` amount spans. */
  period: MetricPeriod
  /** Flat target, e.g. 10 per semester. Absent when per-study-year. */
  target?: number
  /** Targets that vary by study year (ročník 1..3), e.g. revenue. */
  targetPerStudyYear?: Record<number, number>
  /** Cumulative expectation for the whole study. */
  totalForStudy?: number
  /** Individual-minimum column from the metrics sheet. */
  individualMinimum?: number
  /** "percent" metrics (Houston Calling, Training Session) vs plain counts. */
  unit?: "percent" | "count"
}

export const METRICS = {
  "houston-calling": {
    label: "Houston Calling",
    period: "year",
    target: 80,
    totalForStudy: 80,
    individualMinimum: 80,
    unit: "percent",
  },
  "training-session": {
    label: "Training Session",
    period: "semester",
    target: 80,
    totalForStudy: 80,
    individualMinimum: 80,
    unit: "percent",
  },
  "knizni-body": {
    label: "Knižní body",
    period: "semester",
    target: 20,
    totalForStudy: 120,
    individualMinimum: 120,
  },
  "customer-meetings": {
    label: "Zákaznické schůzky",
    period: "semester",
    target: 10,
    totalForStudy: 60,
    individualMinimum: 60,
  },
  // TODO(metrics): sheet says "9+1" / "7+1" — meaning of the "+1" unconfirmed;
  // modeled as plain totals until clarified.
  "birth-giving": {
    label: "Birth Giving",
    period: "semester",
    target: 2,
    totalForStudy: 9,
    individualMinimum: 7,
  },
  vynos: {
    label: "Výnos",
    period: "year",
    targetPerStudyYear: { 1: 10_000, 2: 60_000, 3: 50_000 },
    totalForStudy: 120_000,
    individualMinimum: 100_000,
  },
  crossfertilizace: {
    label: "Crossfertilizace",
    period: "semester",
    target: 4,
    totalForStudy: 22,
    individualMinimum: 15,
  },
  "komunitni-role": {
    label: "Komunitní role",
    period: "study",
    target: 0.5,
    totalForStudy: 0.5,
    individualMinimum: 0,
  },
} as const satisfies Record<string, MetricDefinition>

export type MetricId = keyof typeof METRICS

export function getMetric(id: MetricId): MetricDefinition {
  return METRICS[id]
}
