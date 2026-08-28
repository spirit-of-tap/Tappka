'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContentSourceIllustration } from './content-source-illustration';
import { formatPoints } from '@/lib/books/points';
import { CONTENT_SOURCE_POINT_VALUES } from '@/lib/content-sources/points';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSource } from '@/lib/content-sources/types';

interface ContentSourceReviewListProps {
  initialPending: ContentSource[];
}

const POINT_VALUES_DATALIST_ID = 'content-source-review-point-values';

/** PostgREST returns numeric as a string ("0.50"); the input wants "0.5". */
function pointsFieldValue(points: ContentSource['points']): string {
  return points == null ? '' : String(Number(points));
}

export function ContentSourceReviewList({ initialPending }: ContentSourceReviewListProps) {
  const [pending, setPending] = useState(initialPending);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  // The student's value is only a proposal — the coach decides what it is worth,
  // so every pending row carries its own editable draft of the points.
  const [pointsDraft, setPointsDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialPending.map((s) => [s.id, pointsFieldValue(s.points)])),
  );

  const decide = async (source: ContentSource, status: 'approved' | 'archived') => {
    setPendingActionId(source.id);
    const draft = pointsDraft[source.id] ?? pointsFieldValue(source.points);
    try {
      const res = await fetch(`/api/content-sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, points: draft === '' ? null : Number(draft) }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Nepodařilo se uložit rozhodnutí.');
        return;
      }
      setPending((current) => current.filter((s) => s.id !== source.id));
    } finally {
      setPendingActionId(null);
    }
  };

  if (pending.length === 0) {
    return <p className="text-sm text-muted-foreground">Žádné zdroje nečekají na schválení.</p>;
  }

  return (
    <>
      {/* Outside the <ul>: only <li> may be its child. */}
      <datalist id={POINT_VALUES_DATALIST_ID}>
        {CONTENT_SOURCE_POINT_VALUES.map((v) => <option key={v} value={v} />)}
      </datalist>
      <ul className="space-y-2">
      {pending.map((source) => (
        <li key={source.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
          <ContentSourceIllustration kind={source.kind} className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{source.title}</p>
            <p className="truncate text-sm text-muted-foreground">
              {CONTENT_SOURCE_KIND_LABELS[source.kind]}
              {source.creator ? ` · ${source.creator}` : ''}
              {source.points != null ? ` · ${formatPoints(source.points)} b. (návrh)` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Label htmlFor={`content-source-points-${source.id}`} className="text-xs text-muted-foreground">
              Body
            </Label>
            <Input
              id={`content-source-points-${source.id}`}
              type="number"
              step="0.5"
              min="0"
              max="3"
              className="h-9 w-20"
              value={pointsDraft[source.id] ?? ''}
              onChange={(e) => setPointsDraft((current) => ({ ...current, [source.id]: e.target.value }))}
              list={POINT_VALUES_DATALIST_ID}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pendingActionId === source.id}
            onClick={() => void decide(source, 'archived')}
          >
            Zamítnout
          </Button>
          <Button
            size="sm"
            disabled={pendingActionId === source.id}
            onClick={() => void decide(source, 'approved')}
          >
            Schválit
          </Button>
        </li>
      ))}
      </ul>
    </>
  );
}
