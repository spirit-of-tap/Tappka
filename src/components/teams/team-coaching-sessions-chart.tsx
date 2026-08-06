'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  MEMBER_CHART_NAME_WIDTH,
  memberChartHeight,
} from '@/lib/charts/member-chart-layout';
import { shortName } from '@/lib/string-utils';
import type { TeamMemberCoachingStats } from '@/lib/individual-coaching-sessions/queries';

interface TeamCoachingSessionsChartProps {
  stats: TeamMemberCoachingStats[]
}

export function TeamCoachingSessionsChart({ stats }: TeamCoachingSessionsChartProps) {
  if (stats.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Tým nemá žádné členy</p>
  }

  const data = [...stats]
    .sort((a, b) => b.count - a.count)
    .map((s) => ({
      name: shortName(s.profile.name),
      Sezení: s.count,
    }))

  const maxCount = Math.max(...data.map((d) => d.Sezení), 1)

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={memberChartHeight(data.length)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, maxCount + 2]} tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={MEMBER_CHART_NAME_WIDTH}
            tick={{ fontSize: 11 }}
          />
          <Tooltip />
          <Bar dataKey="Sezení" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
