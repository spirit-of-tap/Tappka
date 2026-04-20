'use client';

import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PortfolioEsejeRow } from '@/lib/portfolio/types';

const POINT_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  3: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

function PointsBadge({ points }: { points: number }) {
  const color = POINT_COLORS[points] ?? 'bg-muted text-muted-foreground';
  const dots = '●'.repeat(Math.min(points, 3)) + '○'.repeat(Math.max(0, 3 - points));
  return <Badge className={color}>{dots} {points}b</Badge>;
}

function topCategory(rows: PortfolioEsejeRow[]): string {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.category) counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
}

export function EsejeTable({ rows }: { rows: PortfolioEsejeRow[] }) {
  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0);
  const top = topCategory(rows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6 px-1 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{rows.length}</span> knih
        </span>
        <span>
          <span className="font-semibold text-foreground">{totalPoints}</span> bodů celkem
        </span>
        <span>
          Top kategorie: <span className="font-semibold text-foreground">{top}</span>
        </span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="w-10 px-3 py-3 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground min-w-[200px]">Název knihy</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground min-w-[140px]">Autor</th>
                <th className="w-24 px-3 py-3 text-center font-medium text-muted-foreground">Esej</th>
                <th className="px-3 py-3 text-left font-medium text-muted-foreground min-w-[120px]">Kategorie</th>
                <th className="w-24 px-3 py-3 text-left font-medium text-muted-foreground">Zdroj</th>
                <th className="w-24 px-3 py-3 text-center font-medium text-muted-foreground">Body</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.essayId} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{row.index}</td>
                  <td className="px-3 py-2.5 font-medium">{row.bookTitle}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.author || '—'}</td>
                  <td className="px-3 py-2.5 text-center">
                    <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                      <a href={row.essayUrl} target="_blank" rel="noopener noreferrer" title={row.essayTitle}>
                        <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.category
                      ? <Badge variant="secondary" className="font-normal">{row.category}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.source}</td>
                  <td className="px-3 py-2.5 text-center">
                    <PointsBadge points={row.points} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
