/**
 * Single source of truth for study-goal metrics ("Nastavené metriky").
 * Pages read their goal from here — never hardcode targets in a page.
 */
export type MetricPeriod = "week" | "semester" | "year" | "study"

/** "percent" (Houston Calling, Training Session), plain counts, or hours (Čas). */
export type MetricUnit = "percent" | "count" | "hours"

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
  /** Absent means a plain count. */
  unit?: MetricUnit
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
  // Not on the original sheet — the expectation lives in app copy
  // ("alespoň jedno sezení za semestr" from the koučování info card);
  // 6 semesters over 3 years of study.
  "individual-coaching": {
    label: "Individuální koučování",
    period: "semester",
    target: 1,
    totalForStudy: 6,
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
  // Čas: ~40 h per week across Training / Reading / Practise (one metric,
  // per-direction breakdown is informative only).
  "time-weekly": {
    label: "Čas týdně",
    period: "week",
    target: 40,
    unit: "hours",
  },
} as const satisfies Record<string, MetricDefinition>

export type MetricId = keyof typeof METRICS

export function getMetric(id: MetricId): MetricDefinition {
  return METRICS[id]
}

/** Czech period phrase for a metric goal row, e.g. "tento týden". */
export const METRIC_PERIOD_LABELS: Record<MetricPeriod, string> = {
  week: "tento týden",
  semester: "tento semestr",
  year: "tento rok",
  study: "za studium",
}

const HOURS_FORMAT = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 })
const COUNT_FORMAT = new Intl.NumberFormat("cs-CZ")

/**
 * Formats a metric amount in its unit with Czech number formatting:
 * hours → "12,5 h", percent → "80 %", count → "6".
 */
export function formatMetricValue(value: number, unit: MetricUnit = "count"): string {
  switch (unit) {
    case "hours":
      return `${HOURS_FORMAT.format(value)}\u00a0h`
    case "percent":
      return `${COUNT_FORMAT.format(value)}\u00a0%`
    case "count":
      return COUNT_FORMAT.format(value)
  }
}
