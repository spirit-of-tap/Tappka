'use client';

import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';
import type { FeedbackWithAuthor } from '@/lib/feedback/types';

interface FeedbackNoteCardProps {
  feedback: FeedbackWithAuthor;
  isAdmin: boolean;
  onChanged: (feedback: FeedbackWithAuthor) => void;
  onDeleted: (id: string) => void;
}

// Deterministic slight tilt so cards feel like sticky notes without hydration mismatch.
const TILTS = ['-rotate-1', 'rotate-1', '-rotate-2', 'rotate-2', 'rotate-0'] as const;
function tiltFor(id: string): string {
  const sum = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return TILTS[sum % TILTS.length];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function FeedbackNoteCard({ feedback, isAdmin, onChanged, onDeleted }: FeedbackNoteCardProps) {
  const [isSaving, setIsSaving] = useState(false);

  const patch = async (payload: Record<string, unknown>) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/feedback/${feedback.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      onChanged(data);
    } catch {
      toast.error('Nepodařilo se uložit změnu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/feedback/${feedback.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onDeleted(feedback.id);
    } catch {
      toast.error('Nepodařilo se smazat příspěvek.');
    } finally {
      setIsSaving(false);
    }
  };

  const isResolved = feedback.resolved_at !== null;
  const role = feedback.author?.role;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-l-4 border-l-warning bg-card p-4 shadow-sm transition-transform',
        tiltFor(feedback.id),
      )}
    >
      <p className="whitespace-pre-wrap text-sm text-foreground">{feedback.body}</p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{feedback.author?.name ?? 'Neznámý'}</span>
        {role && (
          <Badge variant="secondary" className={cn('px-1.5 py-0 text-[10px]', ROLE_COLORS[role])}>
            {ROLE_LABELS[role]}
          </Badge>
        )}
        <span>· {formatDate(feedback.created_at)}</span>
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => patch({ resolved: !isResolved })}
            disabled={isSaving}
            className="gap-1"
          >
            {isSaving ? (
              <Spinner className="size-3" />
            ) : isResolved ? (
              <ArchiveRestore className="size-3" />
            ) : (
              <Archive className="size-3" />
            )}
            {isResolved ? 'Obnovit' : 'Archivovat'}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={isSaving} className="gap-1 text-destructive">
            {isSaving ? <Spinner className="size-3" /> : <Trash2 className="size-3" />}
            Smazat
          </Button>
        </div>
      )}
    </div>
  );
}
