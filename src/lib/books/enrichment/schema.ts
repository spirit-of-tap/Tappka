import { BOOK_CATEGORIES } from '@/lib/books/types';

export const SUGGESTED_POINTS_VALUES = [1, 2, 3] as const;
export type SuggestedPoints = (typeof SUGGESTED_POINTS_VALUES)[number];

export interface EnrichedBook {
  title_cs: string;
  title_en: string | null;
  author: string;
  isbn_13: string | null;
  page_count: number | null;
  description: string;
  tag: string;
  suggested_points: SuggestedPoints;
  points_reason: string;
  confidence: 'high' | 'low';
}

/** Passed as `response_format.json_schema.schema`. Perplexity enforces the shape server-side. */
export const ENRICHMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title_cs: { type: 'string' },
    title_en: { type: ['string', 'null'] },
    author: { type: 'string' },
    isbn_13: { type: ['string', 'null'] },
    page_count: { type: ['integer', 'null'] },
    description: { type: 'string' },
    tag: { type: 'string', enum: [...BOOK_CATEGORIES] },
    suggested_points: { type: 'integer', enum: [...SUGGESTED_POINTS_VALUES] },
    points_reason: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'low'] },
  },
  required: [
    'title_cs',
    'author',
    'description',
    'tag',
    'suggested_points',
    'points_reason',
    'confidence',
  ],
} as const;

export type ParseResult =
  | { ok: true; value: EnrichedBook }
  | { ok: false; error: string };

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nullableInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Validates a Perplexity payload. `response_format` makes a violation unlikely
 * but not impossible, and a bad tag would surface as an RLS failure at write
 * time — so nothing reaches the database unvalidated.
 */
export function parseEnrichment(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Odpověď není objekt.' };
  }

  const source = raw as Record<string, unknown>;

  const titleCs = nonEmptyString(source.title_cs);
  if (!titleCs) return { ok: false, error: 'Chybí title_cs.' };

  const author = nonEmptyString(source.author);
  if (!author) return { ok: false, error: 'Chybí author.' };

  const description = nonEmptyString(source.description);
  if (!description) return { ok: false, error: 'Chybí description.' };

  const pointsReason = nonEmptyString(source.points_reason);
  if (!pointsReason) return { ok: false, error: 'Chybí points_reason.' };

  const tag = nonEmptyString(source.tag);
  if (!tag || !(BOOK_CATEGORIES as readonly string[]).includes(tag)) {
    return { ok: false, error: `Neznámý tag: ${String(source.tag)}` };
  }

  const points = source.suggested_points;
  if (!SUGGESTED_POINTS_VALUES.includes(points as SuggestedPoints)) {
    return { ok: false, error: `Neplatné suggested_points: ${String(points)}` };
  }

  return {
    ok: true,
    value: {
      title_cs: titleCs,
      title_en: nullableString(source.title_en),
      author,
      isbn_13: nullableString(source.isbn_13),
      page_count: nullableInteger(source.page_count),
      description,
      tag,
      suggested_points: points as SuggestedPoints,
      points_reason: pointsReason,
      // Anything we don't recognise is treated as uncertain, so Krok 4 flags it.
      confidence: source.confidence === 'high' ? 'high' : 'low',
    },
  };
}
