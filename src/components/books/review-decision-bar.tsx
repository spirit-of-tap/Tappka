'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, RefreshCw, ThumbsDown, ThumbsUp, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { REVIEW_POINT_VALUES, suggestedReviewPoints, type ReviewPoints } from '@/lib/books/points';
import { reEnrichBook } from '@/lib/books/re-enrich';
import { cn } from '@/lib/utils';
import { AiVerdictCard } from './ai-verdict-card';
import { DeleteBookDialog } from './delete-book-dialog';
import type { BookWithProfiles } from '@/lib/books/types';

/** Matches the `maxLength` the previous row enforced and the column's practical use. */
const REASON_MAX_LENGTH = 1000;

/** Reads as a scale, so the reject end is labelled rather than left as a bare 0. */
const POINT_LABELS: Record<ReviewPoints, string> = {
  0: '0 — zamítnout',
  1: '1 bod',
  2: '2 body',
  3: '3 body',
};

interface ReviewDecisionBarProps {
  book: BookWithProfiles;
  /** 0 archives the book, 1–3 approve it into the longlist. */
  onDecide: (book: BookWithProfiles, points: ReviewPoints, reason: string) => Promise<boolean>;
  /** Called with the re-enriched book so the panel can show the fresh text. */
  onEnriched: (book: BookWithProfiles) => void;
  onDeleted: (bookId: string) => void;
  /** Set while the facts form is open — a half-edited book must not be decided. */
  blocked?: boolean;
}

export function ReviewDecisionBar({
  book,
  onDecide,
  onEnriched,
  onDeleted,
  blocked = false,
}: ReviewDecisionBarProps) {
  const aiPoints = suggestedReviewPoints(book.book_points);
  const aiReason = book.list_status_reason?.trim() ?? '';
  // Only a complete suggestion can be confirmed in one click. A half one — a score
  // with no rationale, or the reverse — would leave a required field empty behind a
  // button that claims everything is ready.
  const hasFullSuggestion = aiPoints !== null && aiReason.length > 0;

  const [points, setPoints] = useState<ReviewPoints | null>(aiPoints);
  const [reason, setReason] = useState(aiReason);
  const [isEditing, setIsEditing] = useState(!hasFullSuggestion);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isBusy = busyAction !== null;
  const isRejection = points === 0;
  const canDecide = points !== null && reason.trim().length > 0 && !isBusy && !blocked;

  const revertToSuggestion = () => {
    setPoints(aiPoints);
    setReason(aiReason);
    setIsEditing(false);
  };

  const decide = async () => {
    if (points === null) return;
    setBusyAction('decide');
    try {
      const ok = await onDecide(book, points, reason.trim());
      if (!ok) setBusyAction(null);
    } catch {
      setBusyAction(null);
    }
  };

  // Unlike a decision, re-enrichment leaves the book in the queue, so the bar
  // always comes back to life afterwards.
  const handleReEnrich = async () => {
    setBusyAction('re-enrich');
    try {
      const result = await reEnrichBook(book);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onEnriched(result.book);
      toast.success('Údaje o knize byly dohledány.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="shrink-0 space-y-3 border-t bg-muted/30 p-4 sm:p-5">
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Rozhodnutí kouče
      </span>

      {isEditing ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>
              Body
              <span className="text-destructive"> *</span>
            </Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={points === null ? '' : String(points)}
              onValueChange={(value) => {
                if (value) setPoints(Number(value) as ReviewPoints);
              }}
              disabled={isBusy}
              aria-label="Body za knihu"
              className="flex-wrap"
            >
              {REVIEW_POINT_VALUES.map((value) => (
                <ToggleGroupItem
                  key={value}
                  value={String(value)}
                  className={cn(
                    'relative',
                    value === 0 && 'data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive',
                  )}
                  aria-label={POINT_LABELS[value]}
                >
                  {value}
                  {value === aiPoints && (
                    <span
                      aria-hidden
                      title="Návrh AI"
                      className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary"
                    />
                  )}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              0 knihu zamítne, 1–3 ji schválí do longlistu.
              {aiPoints !== null && ` Návrh AI: ${aiPoints}.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <Label htmlFor={`reason-${book.id}`}>
                Důvod rozhodnutí
                <span className="text-destructive"> *</span>
              </Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {reason.length}/{REASON_MAX_LENGTH}
              </span>
            </div>
            <Textarea
              id={`reason-${book.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Stručně popiš, proč knihu schvaluješ nebo zamítáš…"
              className="min-h-20"
              maxLength={REASON_MAX_LENGTH}
              disabled={isBusy}
            />
            <p className="text-xs text-muted-foreground">Odešle se studentovi e-mailem.</p>
          </div>
        </div>
      ) : (
        <AiVerdictCard points={book.book_points} reason={book.list_status_reason} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={isRejection ? 'destructive' : 'default'}
          onClick={decide}
          disabled={!canDecide}
          className="min-w-0 flex-1 gap-1.5 sm:flex-none"
        >
          {busyAction === 'decide' ? (
            <Spinner className="size-4" />
          ) : isRejection ? (
            <ThumbsDown className="size-4" />
          ) : (
            <ThumbsUp className="size-4" />
          )}
          <span className="truncate">
            {isRejection ? 'Zamítnout knihu' : 'Schválit do longlistu'}
          </span>
        </Button>

        {isEditing ? (
          hasFullSuggestion && (
            <Button variant="ghost" onClick={revertToSuggestion} disabled={isBusy} className="gap-1.5">
              <Undo2 className="size-4" />
              Zpět k návrhu AI
            </Button>
          )
        ) : (
          <Button variant="outline" onClick={() => setIsEditing(true)} disabled={isBusy} className="gap-1.5">
            <Pencil className="size-4" />
            Upravit rozhodnutí
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={isBusy} aria-label="Další akce">
              {busyAction === 're-enrich' ? (
                <Spinner className="size-4" />
              ) : (
                <MoreHorizontal className="size-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={handleReEnrich}>
              <RefreshCw className="size-4" />
              Dohledat údaje
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              Smazat knihu
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DeleteBookDialog
        book={book}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted}
      />
    </div>
  );
}
