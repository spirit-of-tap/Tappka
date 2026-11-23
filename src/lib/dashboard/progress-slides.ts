import { getMetric } from '@/lib/metrics/config';
import { cumulativeSemesterMilestone } from '@/lib/metrics/semester-milestone';

export type ProgressTone = 'violet' | 'amber';

/** One face of the dashboard's rotating progress card. */
export interface ProgressSlide {
  id: 'knizni-body' | 'zakaznicke-schuzky';
  title: string;
  value: number;
  goal: number;
  studyTotal: number;
  /** Unit after the number in the ring, e.g. "b". */
  unit: string;
  ringLabel: string;
  headline: string;
  detail: string;
  href: string;
  linkLabel: string;
  tone: ProgressTone;
}

export interface BookStats {
  approved_points: number;
  pending_points: number;
  essay_count: number;
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  return n >= 2 && n <= 4 ? few : many;
}

function headline(value: number, goal: number, words: [string, string, string]): string {
  const remaining = goal - value;
  if (remaining > 0) {
    const verb = remaining >= 2 && remaining <= 4 ? 'Zbývají' : 'Zbývá';
    return `${verb} ${remaining} ${plural(remaining, ...words)}`;
  }
  return `Cíl splněn${value > goal ? ` (+${value - goal})` : ''}`;
}

function bookSummary(stats: BookStats): string {
  const essays =
    stats.essay_count === 0
      ? 'Zatím žádné eseje'
      : `${stats.essay_count} ${plural(stats.essay_count, 'esej', 'eseje', 'esejí')}`;
  const pending = stats.pending_points;
  if (pending === 0) return essays;
  return `${essays} · ${pending} ${plural(pending, 'kniha čeká', 'knihy čekají', 'knih čeká')} na schválení`;
}

export function bookPointsSlide(stats: BookStats, semester: number): ProgressSlide {
  const metric = getMetric('knizni-body');
  const studyTotal = metric.totalForStudy ?? 0;
  const goal = cumulativeSemesterMilestone(metric.target ?? 0, studyTotal, semester);
  const value = stats.approved_points;
  const words: [string, string, string] = ['bod', 'body', 'bodů'];
  return {
    id: 'knizni-body',
    title: `Knižní body · ${semester}. semestr`,
    value,
    goal,
    studyTotal,
    unit: 'b',
    ringLabel: `${value} z ${goal} knižních bodů`,
    headline: headline(value, goal, words),
    detail: `Do konce semestru máš mít ${goal} ${plural(goal, ...words)}. ${bookSummary(stats)}.`,
    href: '/cteni/prehled',
    linkLabel: 'Přehled',
    tone: 'violet',
  };
}

export function customerMeetingsSlide(count: number, semester: number): ProgressSlide {
  const metric = getMetric('customer-meetings');
  const studyTotal = metric.totalForStudy ?? 0;
  const goal = cumulativeSemesterMilestone(metric.target ?? 0, studyTotal, semester);
  const words: [string, string, string] = ['schůzka', 'schůzky', 'schůzek'];
  return {
    id: 'zakaznicke-schuzky',
    title: `Zákaznické schůzky · ${semester}. semestr`,
    value: count,
    goal,
    studyTotal,
    unit: 'ZS',
    ringLabel: `${count} z ${goal} zákaznických schůzek`,
    headline: headline(count, goal, ['schůzka', 'schůzky', 'schůzek']),
    detail: `Do konce semestru máš mít ${goal} ${plural(goal, ...words)}.`,
    href: '/schuzky',
    linkLabel: 'Schůzky',
    tone: 'amber',
  };
}
