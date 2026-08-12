import type { BookWithProfiles } from './types';
import type { EnrichedBook } from './enrichment/schema';

/** Everything the enrichment probe needs to re-identify a book already in the DB. */
export type ReEnrichProbe = Pick<BookWithProfiles, 'id' | 'title_cs' | 'author' | 'page_count'>;

/**
 * The caller owns the toast, so the failure branch carries a message rather
 * than raising one itself — that keeps this testable without a DOM.
 */
export type ReEnrichResult =
  | { ok: true; book: BookWithProfiles }
  | { ok: false; error: string };

const GENERIC_ENRICH_ERROR = 'Nepodařilo se dohledat údaje.';
const GENERIC_SAVE_ERROR = 'Nepodařilo se uložit dohledané údaje.';

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

/**
 * Re-runs enrichment for a book whose automatic pass produced nothing useful,
 * then writes the fresh title/author/description back. Returns the saved book so
 * the caller can refresh its local copy — the previous inline version dropped the
 * response, leaving the coach looking at stale text until a reload.
 */
export async function reEnrichBook(book: ReEnrichProbe): Promise<ReEnrichResult> {
  const enrichRes = await fetch('/api/books/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: book.title_cs,
      author: book.author,
      page_count: book.page_count,
    }),
  });
  if (!enrichRes.ok) {
    return { ok: false, error: await errorMessage(enrichRes, GENERIC_ENRICH_ERROR) };
  }

  const { data } = (await enrichRes.json()) as { data: EnrichedBook };

  const patchRes = await fetch(`/api/books/${book.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'edit',
      title: data.title_cs,
      author: data.author,
      description: data.description,
    }),
  });
  if (!patchRes.ok) {
    return { ok: false, error: await errorMessage(patchRes, GENERIC_SAVE_ERROR) };
  }

  const saved = (await patchRes.json()) as { data: BookWithProfiles };
  return { ok: true, book: saved.data };
}
