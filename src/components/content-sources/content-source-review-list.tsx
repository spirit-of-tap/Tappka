'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ContentSourceIllustration } from './content-source-illustration';
import { formatPoints } from '@/lib/books/points';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSource } from '@/lib/content-sources/types';

interface ContentSourceReviewListProps {
  initialPending: ContentSource[];
}

export function ContentSourceReviewList({ initialPending }: ContentSourceReviewListProps) {
  const [pending, setPending] = useState(initialPending);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const decide = async (source: ContentSource, status: 'approved' | 'archived') => {
    setPendingActionId(source.id);
    try {
      const res = await fetch(`/api/content-sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, points: source.points == null ? null : Number(source.points) }),
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
  );
}
