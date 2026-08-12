'use client';

import { useState } from 'react';
import { AlertTriangle, BookOpen, Lock, Send, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import {
  LOW_CONFIDENCE_FIELDS,
  type LowConfidenceField,
} from '@/lib/books/enrichment/schema';
import { cn } from '@/lib/utils';
import { BOOK_CATEGORIES, type CreateBookInput } from '@/lib/books/types';

import type { AddBookDraft } from './types';

const DESCRIPTION_ROWS = 6;

const LOW_CONFIDENCE_LABELS: Record<LowConfidenceField, string> = {
  title_cs: 'český název',
  title_en: 'anglický název',
  author: 'autor',
  isbn_13: 'ISBN',
  page_count: 'počet stran',
  description: 'popis',
  tag: 'oblast',
  suggested_points: 'knižní body',
};

/**
 * Fields the banner must never name, because the submitter has no control for
 * them: the score is the model's verdict and ISBN is carried silently. An
 * uncertain score surfaces as a caveat on the verdict card instead.
 */
const FIELDS_WITHOUT_CONTROLS: readonly LowConfidenceField[] = ['suggested_points', 'isbn_13'];

/** Amber ring + underline hint for a field the model flagged as uncertain. */
const UNCERTAIN_CLASSES =
  'border-amber-400 focus-visible:ring-amber-400/40 dark:border-amber-600';

interface StepReviewProps {
  draft: AddBookDraft;
  submitting: boolean;
  onSubmit: (input: CreateBookInput) => void;
  /** Opens the discard confirmation; the flow owns the draft and navigation. */
  onDiscard: () => void;
}

export function StepReview({ draft, submitting, onSubmit, onDiscard }: StepReviewProps) {
  const { candidate, enriched, appealing } = draft;

  const [titleCs, setTitleCs] = useState(enriched?.title_cs ?? candidate?.title ?? '');
  const [titleEn, setTitleEn] = useState(enriched?.title_en ?? '');
  const [author, setAuthor] = useState(enriched?.author ?? candidate?.author ?? '');
  // An appeal argues with the model, so it starts from a blank page rather than
  // from the "ZAMÍTNUTO" sentence the submitter is disagreeing with.
  const [description, setDescription] = useState(appealing ? '' : enriched?.description ?? '');
  const [tag, setTag] = useState(enriched?.tag ?? '');
  const [pageCount, setPageCount] = useState(
    String(enriched?.page_count ?? candidate?.page_count ?? ''),
  );

  // The score is the model's judgement for the coach, never the submitter's pick.
  const points = enriched?.suggested_points ?? null;

  const ready =
    titleCs.trim().length > 0 &&
    author.trim().length > 0 &&
    description.trim().length > 0 &&
    tag.length > 0;

  const lowFields = new Set(enriched?.low_confidence_fields ?? []);
  const uncertain = (field: LowConfidenceField) =>
    lowFields.has(field)
      ? { 'data-uncertain': true as const, className: cn(UNCERTAIN_CLASSES) }
      : undefined;

  const uncertainNames = LOW_CONFIDENCE_FIELDS.filter(
    (field) => lowFields.has(field) && !FIELDS_WITHOUT_CONTROLS.includes(field),
  )
    .map((field) => LOW_CONFIDENCE_LABELS[field])
    .join(', ');

  const handleSubmit = () => {
    onSubmit({
      title: titleCs.trim(),
      title_en: titleEn.trim() || null,
      author: author.trim(),
      isbn_13: enriched?.isbn_13 ?? candidate?.isbn_13 ?? undefined,
      description: description.trim(),
      page_count: pageCount ? Number.parseInt(pageCount, 10) : null,
      preview_link: candidate?.preview_link ?? null,
      // Stored as-is; covers are not downloaded into our storage.
      google_books_cover_url: candidate?.cover_url ?? null,
      book_points: points,
      points_reason: enriched?.points_reason ?? null,
      tags: [tag],
      source: candidate?.source ?? 'manual',
      // Manual candidates carry no external id; send undefined, not ''.
      external_id: candidate?.external_id ? candidate.external_id : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {enriched ? (
        <VerdictCard
          title={enriched.title_cs}
          author={enriched.author}
          coverUrl={candidate?.cover_url ?? null}
          points={enriched.suggested_points}
          reason={enriched.points_reason}
          scoreUncertain={lowFields.has('suggested_points')}
        />
      ) : (
        <p className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          Body přidělí kouč:ka.
        </p>
      )}

      {uncertainNames.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm">
            <span className="font-semibold">Zkontroluj:</span> {uncertainNames}.
          </p>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="font-heading text-base font-semibold">
          {appealing ? 'Zkontroluj údaje' : 'Oprav, co Tappka spletla'}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="review-title-cs">Český název</Label>
            <Input
              id="review-title-cs"
              value={titleCs}
              onChange={(e) => setTitleCs(e.target.value)}
              {...uncertain('title_cs')}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-title-en">Anglický název</Label>
            <Input
              id="review-title-en"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              {...uncertain('title_en')}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-author">Autor</Label>
            <Input
              id="review-author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              {...uncertain('author')}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-pages">Počet stran</Label>
            <Input
              id="review-pages"
              inputMode="numeric"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value.replace(/\D/g, ''))}
              {...uncertain('page_count')}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="review-tag">Oblast</Label>
          <select
            id="review-tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className={cn(
              'focus-ring h-10 w-full rounded-md border bg-background px-3 text-sm',
              lowFields.has('tag') && UNCERTAIN_CLASSES,
            )}
            {...(lowFields.has('tag') ? { 'data-uncertain': true } : {})}
          >
            <option value="">Vyber oblast…</option>
            {BOOK_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="review-description">
            {appealing ? 'Napiš kouči:ce, proč kniha do BOBa patří' : 'Popis — proč to číst'}
          </Label>
          <Textarea
            id="review-description"
            rows={DESCRIPTION_ROWS}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              appealing
                ? 'Co si z knihy Téčko odnese, co Tappka přehlédla.'
                : 'Co si Téčko z knihy odnese, a co ho může od čtení odradit.'
            }
            {...uncertain('description')}
          />
        </div>
      </section>

      {draft.citations.length > 0 && (
        <details className="rounded-xl border bg-card px-4 py-3">
          <summary className="focus-ring cursor-pointer rounded text-sm font-medium">
            Zdroje ({draft.citations.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {draft.citations.map((url) => (
              <li key={url} className="truncate">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Kniha půjde ke schválení — kouč:ka dostane e-mail.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!ready || submitting}
            onClick={handleSubmit}
            size="lg"
            className="gap-2"
          >
            {submitting ? <Spinner className="size-4" /> : <Send className="size-4" />}
            Odeslat ke schválení
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={onDiscard}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="size-4" />
            Zrušit přidávání
          </Button>
        </div>
      </div>
    </div>
  );
}

interface VerdictCardProps {
  title: string;
  author: string;
  coverUrl: string | null;
  points: number;
  reason: string;
  scoreUncertain: boolean;
}

/**
 * What the model decided, stated once and not editable. There is no control
 * here on purpose — the score reaches the coach as an objective suggestion,
 * and the coach is the one who can change it.
 */
function VerdictCard({
  title,
  author,
  coverUrl,
  points,
  reason,
  scoreUncertain,
}: VerdictCardProps) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted ring-1 ring-border">
          {coverUrl ? (
            // Remote cover, not yet in storage — plain img is correct here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <BookOpen className="size-5 text-muted-foreground/40" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="font-heading font-semibold">{title}</p>
          <p className="truncate text-sm text-muted-foreground">{author}</p>
        </div>

        <div
          className="flex size-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-label={`Knižní body: ${points}`}
        >
          <span className="font-heading text-2xl leading-none font-bold tabular-nums">
            {points}
          </span>
          <span className="text-[0.625rem] leading-tight opacity-80">body</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed">{reason}</p>

      {scoreUncertain && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Hodnocením si Tappka nebyla jistá.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3 shrink-0" />
        Návrh Tappky ke schválení. Kouč:ka ho může změnit.
      </p>
    </section>
  );
}
