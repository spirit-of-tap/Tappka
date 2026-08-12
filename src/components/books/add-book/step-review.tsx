'use client';

import { useState } from 'react';
import { AlertTriangle, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { BOOK_POINT_CATEGORIES } from '@/lib/books/enrichment/rubric';
import { LOW_CONFIDENCE_FIELDS, type LowConfidenceField, type SuggestedPoints } from '@/lib/books/enrichment/schema';
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

/** Amber ring + underline hint for a field the model flagged as uncertain. */
const UNCERTAIN_CLASSES =
  'border-amber-400 focus-visible:ring-amber-400/40 dark:border-amber-600';

interface StepReviewProps {
  draft: AddBookDraft;
  submitting: boolean;
  onSubmit: (input: CreateBookInput) => void;
}

export function StepReview({ draft, submitting, onSubmit }: StepReviewProps) {
  const { candidate, enriched } = draft;

  const [titleCs, setTitleCs] = useState(enriched?.title_cs ?? candidate?.title ?? '');
  const [titleEn, setTitleEn] = useState(enriched?.title_en ?? '');
  const [author, setAuthor] = useState(enriched?.author ?? candidate?.author ?? '');
  const [description, setDescription] = useState(enriched?.description ?? '');
  const [tag, setTag] = useState(enriched?.tag ?? '');
  const [points, setPoints] = useState<SuggestedPoints | null>(enriched?.suggested_points ?? null);
  const [pageCount, setPageCount] = useState(
    String(enriched?.page_count ?? candidate?.page_count ?? ''),
  );

  const ready =
    titleCs.trim().length > 0 &&
    author.trim().length > 0 &&
    description.trim().length > 0 &&
    tag.length > 0 &&
    points !== null;

  const lowFields = new Set(enriched?.low_confidence_fields ?? []);
  const uncertain = (field: LowConfidenceField) =>
    lowFields.has(field)
      ? { 'data-uncertain': true as const, className: cn(UNCERTAIN_CLASSES) }
      : undefined;

  const uncertainNames = LOW_CONFIDENCE_FIELDS.filter((field) => lowFields.has(field))
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
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Zkontroluj a odešli</h2>
        <p className="text-sm text-muted-foreground">
          Tohle se uloží do BOBa. Cokoli můžeš přepsat.
        </p>
      </div>

      {enriched?.confidence === 'low' && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm">
            {uncertainNames.length > 0 ? (
              <>
                <span className="font-semibold">Nejsme si jistí těmito údaji:</span>{' '}
                {uncertainNames}. Zkontroluj je prosím, než knihu odešleš.
              </>
            ) : (
              'U některých údajů si nejsme jistí — zkontroluj je prosím, než knihu odešleš.'
            )}
          </p>
        </div>
      )}

      <div className="space-y-4 rounded-xl border bg-card p-4">
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
          <Label htmlFor="review-description">Popis — proč to číst</Label>
          <Textarea
            id="review-description"
            rows={DESCRIPTION_ROWS}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Co si Téčko z knihy odnese, a co ho může od čtení odradit."
            {...uncertain('description')}
          />
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

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Knižní body</legend>
          <div className="flex flex-wrap gap-2">
            {BOOK_POINT_CATEGORIES.map((category) => (
              <Button
                key={category.points}
                type="button"
                variant={points === category.points ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPoints(category.points)}
              >
                {category.points} b. — {category.name}
              </Button>
            ))}
            <Button
              type="button"
              variant={points === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPoints(0)}
            >
              0 b. — Nesouvisí s programem
            </Button>
          </div>
          {enriched?.points_reason && (
            <p className="text-sm text-muted-foreground italic">{enriched.points_reason}</p>
          )}
        </fieldset>
      </div>

      {draft.citations.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Zdroje
          </h3>
          <ul className="space-y-0.5 text-sm">
            {draft.citations.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>Kniha půjde ke schválení kouči. Bodové hodnocení je návrh — kouč ho může změnit.</p>
        <p>Tvému kouči odejde e-mail.</p>
      </div>

      <Button disabled={!ready || submitting} onClick={handleSubmit} className="w-full gap-2 sm:w-auto">
        {submitting ? <Spinner className="size-4" /> : <Send className="size-4" />}
        Odeslat ke schválení
      </Button>
    </div>
  );
}
