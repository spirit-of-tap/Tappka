'use client';

import { useState } from 'react';
import { History, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TiptapRenderer } from './tiptap-renderer';
import { formatWordCount, formatWordDelta } from '@/lib/essays/text-stats';
import { cn } from '@/lib/utils';
import type { EssayRevisionSummary } from '@/lib/essays/types';

interface EssayHistorySheetProps {
  essayId: string;
  className?: string;
}

interface OpenRevision {
  summary: EssayRevisionSummary;
  content_json: object;
}

/** A checkpoint plus everything the row needs from its neighbours. */
interface RevisionEntry {
  revision: EssayRevisionSummary;
  isNewest: boolean;
  /** Words gained or lost since the next-older checkpoint. */
  delta: string | null;
  /** Titles repeat across checkpoints; only show one where it actually changed. */
  showTitle: boolean;
}

/** One day's worth of checkpoints, newest first, under a human day label. */
interface RevisionDay {
  label: string;
  entries: RevisionEntry[];
}

const UNTITLED = 'Bez názvu';

const TIME_FORMAT = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' });
const DAY_FORMAT = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long' });
const FULL_FORMAT = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

const MS_PER_DAY = 86_400_000;

/** Calendar days between two instants, ignoring the time of day. */
function daysApart(from: Date, to: Date): number {
  const startOf = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOf(to) - startOf(from)) / MS_PER_DAY);
}

function dayLabel(date: Date, now: Date): string {
  const diff = daysApart(date, now);
  if (diff === 0) return 'Dnes';
  if (diff === 1) return 'Včera';
  return DAY_FORMAT.format(date);
}

/**
 * History is a sequence, so it renders as one: grouped by day, newest first.
 * A flat list of timestamps makes the author read dates to find "the version
 * from yesterday evening". The API already returns newest-first.
 */
function buildTimeline(revisions: EssayRevisionSummary[]): RevisionDay[] {
  const now = new Date();
  const days: RevisionDay[] = [];

  revisions.forEach((revision, index) => {
    const older = revisions[index + 1];
    const entry: RevisionEntry = {
      revision,
      isNewest: index === 0,
      delta: older ? formatWordDelta(revision.word_count, older.word_count) : null,
      showTitle: !older || older.title !== revision.title,
    };

    const label = dayLabel(new Date(revision.updated_at), now);
    const current = days.at(-1);
    if (current?.label === label) current.entries.push(entry);
    else days.push({ label, entries: [entry] });
  });

  return days;
}

export function EssayHistorySheet({ essayId, className }: EssayHistorySheetProps) {
  const [revisions, setRevisions] = useState<EssayRevisionSummary[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRevisionNo, setPendingRevisionNo] = useState<number | null>(null);
  const [open, setOpen] = useState<OpenRevision | null>(null);

  // Fetched on open rather than server-rendered: autosave changes the list
  // continuously, so anything rendered at page load would already be stale.
  const loadRevisions = async (isOpen: boolean) => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/revisions`);
      const { data } = await res.json();
      setRevisions(data ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  const openRevision = async (summary: EssayRevisionSummary) => {
    setPendingRevisionNo(summary.revision_no);
    try {
      const res = await fetch(`/api/essays/${essayId}/revisions/${summary.revision_no}`);
      const { data } = await res.json();
      if (data) setOpen({ summary, content_json: data.content_json });
    } finally {
      setPendingRevisionNo(null);
    }
  };

  const days = revisions ? buildTimeline(revisions) : [];

  return (
    <>
      <Sheet onOpenChange={loadRevisions}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className={cn('gap-2', className)}>
            <History className="size-4" />
            Historie
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="font-heading">Historie verzí</SheetTitle>
            <SheetDescription>
              Kontrolní body z tvého psaní. Náhled je jen ke čtení.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading && (
              <div className="space-y-4" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && revisions?.length === 0 && (
              <div className="rounded-xl border border-dashed px-4 py-10 text-center">
                <History className="mx-auto size-5 text-muted-foreground/50" />
                <p className="mt-2 text-sm font-medium">Zatím žádné starší verze.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Každých pár minut psaní tu zanechá kontrolní bod.
                </p>
              </div>
            )}

            {!isLoading && days.length > 0 && (
              <div className="space-y-5">
                {days.map((day) => (
                  <section key={day.label}>
                    <h3 className="sticky -top-4 z-10 -mx-5 mb-1 bg-background/95 px-5 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                      {day.label}
                    </h3>
                    <ol className="ml-1 border-l border-dashed">
                      {day.entries.map(({ revision, isNewest, delta, showTitle }) => {
                        const isPending = pendingRevisionNo === revision.revision_no;

                        return (
                          <li key={revision.revision_no} className="relative">
                            <span
                              aria-hidden
                              className={cn(
                                'absolute top-4 -left-[4.5px] size-2 rounded-full ring-3 ring-background',
                                isNewest ? 'bg-primary' : 'bg-muted-foreground/40',
                              )}
                            />
                            <button
                              type="button"
                              onClick={() => void openRevision(revision)}
                              disabled={isPending}
                              className="focus-ring group ml-3 block w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-semibold tabular-nums">
                                  {TIME_FORMAT.format(new Date(revision.updated_at))}
                                </span>
                                {isNewest && (
                                  <span className="text-xs font-medium text-primary">Aktuální</span>
                                )}
                              </div>

                              {showTitle && (
                                <p className="mt-0.5 truncate text-sm">
                                  {revision.title.trim() ? revision.title : UNTITLED}
                                </p>
                              )}

                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="tabular-nums">
                                  {formatWordCount(revision.word_count)}
                                </span>
                                {delta && (
                                  <span className="tabular-nums text-muted-foreground/70">
                                    {delta}
                                  </span>
                                )}
                                {isPending ? (
                                  <Spinner className="size-3" />
                                ) : (
                                  <Eye className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                                )}
                              </p>

                              {revision.snippet && (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70">
                                  {revision.snippet}
                                </p>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={open != null} onOpenChange={(next) => { if (!next) setOpen(null); }}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-4 pr-12 text-left">
            <p className="text-xs text-muted-foreground">
              Verze {open?.summary.revision_no} ·{' '}
              {open && FULL_FORMAT.format(new Date(open.summary.updated_at))}
            </p>
            <DialogTitle className="font-heading text-xl leading-snug">
              {open?.summary.title.trim() ? open.summary.title : UNTITLED}
            </DialogTitle>
            <DialogDescription>
              {open && formatWordCount(open.summary.word_count)} · jen ke čtení
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-5">
            {open && <TiptapRenderer content={open.content_json} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
