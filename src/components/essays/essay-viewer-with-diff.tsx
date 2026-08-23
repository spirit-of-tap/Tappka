'use client';

import { useState } from 'react';
import { GitCompare, History, Sparkles } from 'lucide-react';
import { TiptapRenderer } from '@/components/essays/tiptap-renderer';
import { Button } from '@/components/ui/button';
import { EssayVisualDiff } from '@/components/essays/essay-visual-diff';
import type { EssayWithDetails, EssayCommentWithAuthor } from '@/lib/essays/types';
import type { EssayFullRevision } from '@/lib/essays/queries';

interface EssayViewerWithDiffProps {
  essay: EssayWithDetails;
  comments: EssayCommentWithAuthor[];
  revisions: EssayFullRevision[];
  currentProfileId: string;
}

export function EssayViewerWithDiff({
  essay,
  comments,
  revisions,
}: EssayViewerWithDiffProps) {
  const [showDiff, setShowDiff] = useState(false);

  // Find coach comments
  const coachComments = comments.filter(
    (c) => c.author?.role === 'coach' || c.author?.role === 'admin',
  );

  const hasCoachComment = coachComments.length > 0;

  // Latest coach comment timestamp
  const latestCoachComment = hasCoachComment
    ? coachComments.reduce((latest, c) => {
        return new Date(c.created_at).getTime() > new Date(latest.created_at).getTime() ? c : latest;
      }, coachComments[0])
    : null;

  const latestCoachCommentTime = latestCoachComment
    ? new Date(latestCoachComment.created_at).getTime()
    : 0;

  // Sort revisions by revision_no ascending
  const sortedRevisions = [...revisions].sort((a, b) => a.revision_no - b.revision_no);

  // Find baseline revision (active during or just before coach comment)
  const baselineRevision =
    hasCoachComment && latestCoachCommentTime > 0
      ? ([...sortedRevisions]
          .reverse()
          .find((r) => new Date(r.created_at).getTime() <= latestCoachCommentTime) ??
        sortedRevisions[0])
      : sortedRevisions[0];

  const currentRevision = sortedRevisions[sortedRevisions.length - 1];

  // Has the author updated the text after the coach's comment (or has multiple revisions)?
  const hasEditsAfterCoachComment =
    hasCoachComment &&
    sortedRevisions.length > 1 &&
    currentRevision &&
    baselineRevision &&
    currentRevision.revision_no > baselineRevision.revision_no &&
    currentRevision.content_text !== baselineRevision.content_text;

  // Also support viewing diff if any multiple revisions exist
  const hasMultipleRevisions =
    sortedRevisions.length > 1 &&
    currentRevision &&
    sortedRevisions[0] &&
    currentRevision.content_text !== sortedRevisions[0].content_text;

  const coachCommentDate = latestCoachComment
    ? new Date(latestCoachComment.created_at).toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <div className="space-y-4 mb-12">
      {/* Alert banner when essay was modified after coach feedback */}
      {hasEditsAfterCoachComment ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-3.5 dark:bg-primary/[0.08]">
          <div className="flex items-center gap-2.5 text-xs text-foreground">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-3.5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Esej byla upravena po komentáři kouče:ky {coachCommentDate ? `(${coachCommentDate})` : ''}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Student:ka zapracoval:a novou revizi textu. Můžeš si prohlédnout, co se změnilo.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={showDiff ? 'default' : 'outline'}
            className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? (
              <>
                <History className="size-3.5" />
                Zobrazit aktuální text
              </>
            ) : (
              <>
                <GitCompare className="size-3.5" />
                Zobrazit provedené změny (Diff)
              </>
            )}
          </Button>
        </div>
      ) : hasMultipleRevisions ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <History className="size-3.5 text-primary shrink-0" />
            <span>Esej má {sortedRevisions.length} revize textu.</span>
          </div>
          <Button
            size="sm"
            variant={showDiff ? 'default' : 'outline'}
            className="h-7 shrink-0 gap-1.5 text-xs"
            onClick={() => setShowDiff(!showDiff)}
          >
            <GitCompare className="size-3.5" />
            {showDiff ? 'Zobrazit aktuální text' : 'Srovnat s původní verzí (Diff)'}
          </Button>
        </div>
      ) : null}

      {/* Main Content Area: Diff or Tiptap */}
      {showDiff && baselineRevision && currentRevision ? (
        <EssayVisualDiff
          oldText={baselineRevision.content_text}
          newText={currentRevision.content_text}
          oldVersionLabel={`Revize ${baselineRevision.revision_no}${coachCommentDate ? ` (${coachCommentDate})` : ''}`}
          newVersionLabel={`Aktuální revize ${currentRevision.revision_no}`}
        />
      ) : (
        <TiptapRenderer content={essay.content_json} />
      )}
    </div>
  );
}
