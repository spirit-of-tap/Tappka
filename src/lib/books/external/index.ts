import type { ExternalBookCandidate } from '../types';
import { searchGoogleBooks, fetchGoogleBookByIsbn } from './google-books';
import { searchOpenLibrary, fetchOpenLibraryByIsbn } from './open-library';

/**
 * Strips an optional `ISBN` prefix, dashes and spaces; returns the bare digits
 * when the result is a plausible 10- or 13-digit code, otherwise null.
 */
export function normalizeIsbn(query: string): string | null {
  const digits = query.replace(/^isbn[\s:]*/i, '').replace(/[\s-]/g, '');
  return /^\d{10}$/.test(digits) || /^\d{13}$/.test(digits) ? digits : null;
}

export function looksLikeIsbn(query: string): boolean {
  return normalizeIsbn(query) !== null;
}

export async function searchExternalBooks(query: string): Promise<ExternalBookCandidate[]> {
  const [googleResults, olResults] = await Promise.allSettled([
    searchGoogleBooks(query),
    searchOpenLibrary(query),
  ]);

  const google = googleResults.status === 'fulfilled' ? googleResults.value : [];
  const ol = olResults.status === 'fulfilled' ? olResults.value : [];

  return mergeByIsbn([...google, ...ol]);
}

/** Search by title/author, or by ISBN when the query is a bare ISBN code. */
export async function searchExternal(query: string): Promise<ExternalBookCandidate[]> {
  const isbn = normalizeIsbn(query);
  if (isbn) {
    const hit = await searchExternalByIsbn(isbn);
    return hit ? [hit] : [];
  }
  return searchExternalBooks(query);
}

export async function searchExternalByIsbn(isbn: string): Promise<ExternalBookCandidate | null> {
  const [googleResult, olResult] = await Promise.allSettled([
    fetchGoogleBookByIsbn(isbn),
    fetchOpenLibraryByIsbn(isbn),
  ]);

  if (googleResult.status === 'fulfilled' && googleResult.value) return googleResult.value;
  if (olResult.status === 'fulfilled' && olResult.value) return olResult.value;
  return null;
}

function mergeByIsbn(candidates: ExternalBookCandidate[]): ExternalBookCandidate[] {
  const seen = new Map<string, ExternalBookCandidate>();
  const out: ExternalBookCandidate[] = [];

  for (const c of candidates) {
    if (c.isbn_13) {
      if (!seen.has(c.isbn_13)) {
        seen.set(c.isbn_13, c);
        out.push(c);
      }
    } else {
      out.push(c);
    }
  }

  return out;
}
