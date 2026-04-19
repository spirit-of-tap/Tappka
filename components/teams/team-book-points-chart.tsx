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
  Cell,
} from 'recharts';
import { BOOK_POINTS_GOAL, BOOK_POINTS_PER_YEAR } from '@/lib/books/types';

interface MemberStats {
  profile: { id: string; name: string; picture: string | null };
  approved_points: number;
  pending_points: number;
}

interface TeamBookPointsChartProps {
  stats: MemberStats[];
}

const SHORT_NAME_MAX = 12;

function shortName(name: string): string {
  const parts = name.split(' ');
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  const result = parts.length > 1 ? `${first} ${last.charAt(0)}.` : first;
  return result.length > SHORT_NAME_MAX ? result.slice(0, SHORT_NAME_MAX - 1) + '…' : result;
}

export function TeamBookPointsChart({ stats }: TeamBookPointsChartProps) {
  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Tým nemá žádné členy</p>;
  }

  const data = stats.map((s) => ({
    name: shortName(s.profile.name),
    Schválené: s.approved_points,
    Čeká: s.pending_points,
  }));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Cíl: {BOOK_POINTS_GOAL} bodů celkem · čáry 40 / 80 / 120
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, BOOK_POINTS_GOAL + 10]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <ReferenceLine y={BOOK_POINTS_PER_YEAR} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '40', fontSize: 11, fill: '#f59e0b' }} />
          <ReferenceLine y={BOOK_POINTS_PER_YEAR * 2} stroke="#f97316" strokeDasharray="4 2" label={{ value: '80', fontSize: 11, fill: '#f97316' }} />
          <ReferenceLine y={BOOK_POINTS_GOAL} stroke="#22c55e" strokeDasharray="4 2" label={{ value: '120', fontSize: 11, fill: '#22c55e' }} />
          <Bar dataKey="Schválené" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Čeká" stackId="a" fill="#93c5fd" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
