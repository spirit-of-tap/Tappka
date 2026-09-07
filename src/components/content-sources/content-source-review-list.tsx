import { useState } from 'react';
import { ExternalLink, Radio } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ContentSourceIllustration } from './content-source-illustration';
import { formatPoints } from '@/lib/books/points';
import { CONTENT_SOURCE_POINT_VALUES } from '@/lib/content-sources/points';
import { CONTENT_SOURCE_KIND_LABELS } from '@/lib/content-sources/types';
import type { ContentSourceWithProfiles } from '@/lib/content-sources/types';

interface ContentSourceReviewListProps {
  initialPending: ContentSourceWithProfiles[];
  onDecideSuccess?: (source: ContentSourceWithProfiles, status: 'approved' | 'archived', points: number | null) => void;
}

const POINT_VALUES_DATALIST_ID = 'content-source-review-point-values';

/** PostgREST returns numeric as a string ("0.50"); the input wants "0.5". */
function pointsFieldValue(points: ContentSourceWithProfiles['points']): string {
  return points == null ? '' : String(Number(points));
}

export function ContentSourceReviewList({ initialPending, onDecideSuccess }: ContentSourceReviewListProps) {
  const [pending, setPending] = useState(initialPending);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  // The student's value is only a proposal — the coach decides what it is worth,
  // so every pending row carries its own editable draft of the points.
  const [pointsDraft, setPointsDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialPending.map((s) => [s.id, pointsFieldValue(s.points)])),
  );

  const decide = async (source: ContentSourceWithProfiles, status: 'approved' | 'archived') => {
    setPendingActionId(source.id);
    const draft = pointsDraft[source.id] ?? pointsFieldValue(source.points);
    const resolvedPoints = draft === '' ? null : Number(draft);
    try {
      const res = await fetch(`/api/content-sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, points: resolvedPoints }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? 'Nepodařilo se uložit rozhodnutí.');
        return;
      }
      setPending((current) => current.filter((s) => s.id !== source.id));
      toast.success(status === 'approved' ? 'Zdroj schválen.' : 'Zdroj zamítnut.');
      onDecideSuccess?.(source, status, resolvedPoints);
    } finally {
      setPendingActionId(null);
    }
  };

  if (pending.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Radio />
          </EmptyMedia>
          <EmptyTitle>Žádné zdroje ke schválení</EmptyTitle>
          <EmptyDescription>Všechny navržené podcasty, konference a programy jsou zpracované.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <datalist id={POINT_VALUES_DATALIST_ID}>
        {CONTENT_SOURCE_POINT_VALUES.map((v) => <option key={v} value={v} />)}
      </datalist>
      <ul className="space-y-3">
        {pending.map((source) => (
          <li key={source.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <ContentSourceIllustration kind={source.kind} className="size-12 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-base leading-snug">{source.title}</span>
                  {source.external_url && (
                    <a
                      href={source.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      <span>Otevřít odkaz</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{CONTENT_SOURCE_KIND_LABELS[source.kind]}</span>
                  {source.creator && <span>· {source.creator}</span>}
                  {source.points != null && <span>· Návrh: {formatPoints(source.points)} b.</span>}
                  {source.created_by && (
                    <span className="inline-flex items-center gap-1.5 ml-1">
                      · Navrhl:ka
                      <ProfileAvatar
                        name={source.created_by.name ?? 'Uživatel:ka'}
                        picture={source.created_by.picture}
                        size={16}
                      />
                      <span className="font-medium text-foreground">{source.created_by.name}</span>
                    </span>
                  )}
                </div>

                {source.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 italic">
                    &ldquo;{source.description}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 pt-2 border-t sm:border-t-0 sm:pt-0">
              <div className="flex items-center gap-1.5 mr-1">
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
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
