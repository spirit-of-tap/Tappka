'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BOOK_POINTS_GOAL, BOOK_POINTS_PER_YEAR } from '@/lib/books/types';
import {
  MEMBER_CHART_LEGEND_HEIGHT,
  MEMBER_CHART_NAME_WIDTH,
  MEMBER_CHART_REFERENCE_LABEL_HEIGHT,
  memberChartHeight,
} from '@/lib/charts/member-chart-layout';
import { shortName } from '@/lib/string-utils';

interface MemberStats {
  profile: { id: string; name: string; picture: string | null };
  approved_points: number;
  pending_points: number;
}

interface TeamBookPointsChartProps {
  stats: MemberStats[];
}

export function TeamBookPointsChart({ stats }: TeamBookPointsChartProps) {
  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Tým nemá žádné členy:ky</p>;
  }

  const data = [...stats]
    .sort(
      (a, b) =>
        b.approved_points + b.pending_points - (a.approved_points + a.pending_points),
    )
    .map((s) => ({
      name: shortName(s.profile.name),
      Schválené: s.approved_points,
      Čeká: s.pending_points,
    }));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Cíl: {BOOK_POINTS_GOAL} bodů celkem · čáry 40 / 80 / 120
      </p>
      <ResponsiveContainer
        width="100%"
        height={memberChartHeight(
          data.length,
          MEMBER_CHART_LEGEND_HEIGHT + MEMBER_CHART_REFERENCE_LABEL_HEIGHT,
        )}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: MEMBER_CHART_REFERENCE_LABEL_HEIGHT, right: 16, left: 0, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, BOOK_POINTS_GOAL + 10]} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={MEMBER_CHART_NAME_WIDTH}
            tick={{ fontSize: 11 }}
          />
          <Tooltip />
          <Legend />
          <ReferenceLine x={BOOK_POINTS_PER_YEAR} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '40', fontSize: 11, fill: '#f59e0b', position: 'top' }} />
          <ReferenceLine x={BOOK_POINTS_PER_YEAR * 2} stroke="#f97316" strokeDasharray="4 2" label={{ value: '80', fontSize: 11, fill: '#f97316', position: 'top' }} />
          <ReferenceLine x={BOOK_POINTS_GOAL} stroke="#22c55e" strokeDasharray="4 2" label={{ value: '120', fontSize: 11, fill: '#22c55e', position: 'top' }} />
          <Bar dataKey="Schválené" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Čeká" stackId="a" fill="#93c5fd" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
