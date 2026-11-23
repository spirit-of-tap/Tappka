import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { DashboardCardTitle } from '@/components/dashboard/dashboard-card-title';
import { getMetric } from '@/lib/metrics/config';
import { cumulativeSemesterMilestone, currentStudySemester } from '@/lib/metrics/semester-milestone';

interface ReadingProgressCardProps {
  stats: { approved_points: number; pending_points: number; essay_count: number; approved_points_this_semester?: number };
  /** Team cohort year; decides which semester's cumulative goal applies. */
  onboardingYear?: number | null;
}

const KNIZNI_BODY_METRIC = getMetric('knizni-body');
const SEMESTER_TARGET = KNIZNI_BODY_METRIC.target ?? 0;
const STUDY_TARGET = KNIZNI_BODY_METRIC.totalForStudy ?? 0;

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function pointsWord(n: number): string {
  if (n === 1) return 'bod';
  return n >= 2 && n <= 4 ? 'body' : 'bodů';
}

function percent(current: number, target: number): number {
  return target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
}

function summary(stats: ReadingProgressCardProps['stats']): string {
  const essays =
    stats.essay_count === 0
      ? 'Zatím žádné eseje'
      : `${stats.essay_count} ${stats.essay_count === 1 ? 'esej' : stats.essay_count < 5 ? 'eseje' : 'esejí'}`;
  if (stats.pending_points === 0) return essays;
  const pending = stats.pending_points;
  return `${essays} · ${pending} ${pending === 1 ? 'kniha čeká' : pending < 5 ? 'knihy čekají' : 'knih čeká'} na schválení`;
}

export function ReadingProgressCard({ stats, onboardingYear }: ReadingProgressCardProps) {
  const semester = currentStudySemester(new Date(), onboardingYear);
  const goal = cumulativeSemesterMilestone(SEMESTER_TARGET, STUDY_TARGET, semester);
  const points = stats.approved_points;
  const remaining = Math.max(0, goal - points);
  const dash = (percent(points, goal) / 100) * RING_CIRCUMFERENCE;

  return (
    <Card className="h-full">
      <CardHeader>
        <DashboardCardTitle className="text-chart-5">Čtení · {semester}. semestr</DashboardCardTitle>
        <CardAction>
          <Link
            href="/cteni/prehled"
            className="inline-flex items-center gap-1 text-sm font-medium text-chart-5 hover:underline underline-offset-4"
          >
            Přehled
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <svg
            viewBox="0 0 96 96"
            className="size-24 shrink-0"
            role="img"
            aria-label={`${points} z ${goal} knižních bodů`}
          >
            <circle cx="48" cy="48" r={RING_RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
            <circle
              cx="48"
              cy="48"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${RING_CIRCUMFERENCE}`}
              transform="rotate(-90 48 48)"
              className="stroke-chart-5"
            />
            <text x="48" y="47" textAnchor="middle" className="fill-foreground font-heading text-[22px] font-extrabold">
              {points}
            </text>
            <text x="48" y="64" textAnchor="middle" className="fill-muted-foreground text-[11px]">
              z {goal} b
            </text>
          </svg>
          <div className="min-w-0 space-y-1">
            <p className="font-heading text-lg font-bold">
              {remaining > 0
                ? `Zbývá ${remaining} ${pointsWord(remaining)}`
                : `Cíl splněn${points > goal ? ` (+${points - goal})` : ''}`}
            </p>
            <p className="text-sm text-muted-foreground">
              Do konce semestru máš mít {goal} {pointsWord(goal)}. {summary(stats)}.
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex text-xs text-muted-foreground">
            <span>Za celé studium</span>
            <span className="ml-auto tabular-nums">
              <b className="text-foreground">{points}</b> / {STUDY_TARGET} b
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-chart-5" style={{ width: `${percent(points, STUDY_TARGET)}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
