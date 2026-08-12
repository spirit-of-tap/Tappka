'use client';

import { useState } from 'react';
import { MoreHorizontal, RefreshCw, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
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
import { COACH_POINT_VALUES, suggestedBookPoints, type CoachPoints } from '@/lib/books/points';
import { reEnrichBook } from '@/lib/books/re-enrich';
import { DeleteBookDialog } from './delete-book-dialog';
import type { BookWithProfiles } from '@/lib/books/types';

/** Matches the `maxLength` the previous row enforced and the column's practical use. */
const REASON_MAX_LENGTH = 1000;

interface ReviewDecisionBarProps {
  book: BookWithProfiles;
  onApprove: (book: BookWithProfiles, bookPoints: CoachPoints, reason: string) => Promise<boolean>;
  onReject: (book: BookWithProfiles, reason: string) => Promise<boolean>;
  /** Called with the re-enriched book so the panel can show the fresh text. */
  onEnriched: (book: BookWithProfiles) => void;
  onDeleted: (bookId: string) => void;
  /** Set while the facts form is open — a half-edited book must not be decided. */
  blocked?: boolean;
}

export function ReviewDecisionBar({
  book,
  onApprove,
  onReject,
  onEnriched,
  onDeleted,
  blocked = false,
}: ReviewDecisionBarProps) {
  const aiSuggestion = suggestedBookPoints(book.book_points);
  const hasAiScore = book.book_points !== null;
  // Until a coach decides, `list_status_reason` holds the AI's rationale — that is
  // what seeds the textarea. A book that arrived without one gets no such claim.
  const hasAiReason = Boolean(book.list_status_reason?.trim());

  const [points, setPoints] = useState<CoachPoints>(aiSuggestion);
  const [reason, setReason] = useState(book.list_status_reason ?? '');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isBusy = busyAction !== null;
  const canDecide = reason.trim().length > 0 && !isBusy && !blocked;

  const run = async (action: string, fn: () => Promise<boolean>) => {
    setBusyAction(action);
    try {
      const ok = await fn();
      if (!ok) setBusyAction(null);
    } catch {
      setBusyAction(null);
    }
  };

  // Not routed through `run` — unlike a decision, re-enrichment leaves the book in
  // the queue, so the bar always comes back to life afterwards.
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
    <div className="sticky bottom-0 space-y-3 border-t bg-card/95 p-4 backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rozhodnutí kouče
        </span>
        <span className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            variant="outline"
            value={String(points)}
            onValueChange={(value) => {
              if (value) setPoints(Number(value) as CoachPoints);
            }}
            disabled={isBusy}
            aria-label="Body za knihu"
          >
            {COACH_POINT_VALUES.map((value) => (
              <ToggleGroupItem
                key={value}
                value={String(value)}
                className="relative"
                aria-label={`${value} ${value === 1 ? 'bod' : 'body'}`}
              >
                {value}
                {hasAiScore && value === aiSuggestion && (
                  <span
                    aria-hidden
                    className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-primary"
                  />
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {hasAiScore && (
            <span className="text-xs text-muted-foreground">
              {points === aiSuggestion ? 'shodné s návrhem AI' : `návrh AI: ${aiSuggestion}`}
            </span>
          )}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
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
        <p className="text-xs text-muted-foreground">
          {hasAiReason && 'Text je předvyplněn návrhem AI — uprav ho před rozhodnutím. '}
          Odešle se studentovi e-mailem.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => run('approve', () => onApprove(book, points, reason.trim()))}
          disabled={!canDecide}
          className="gap-1.5"
        >
          {busyAction === 'approve' ? <Spinner className="size-4" /> : <ThumbsUp className="size-4" />}
          Schválit do longlistu
        </Button>
        <Button
          variant="destructive"
          onClick={() => run('reject', () => onReject(book, reason.trim()))}
          disabled={!canDecide}
          className="gap-1.5"
        >
          {busyAction === 'reject' ? <Spinner className="size-4" /> : <ThumbsDown className="size-4" />}
          Odmítnout
        </Button>

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
