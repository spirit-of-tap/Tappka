import type { ExternalBookCandidate } from '../types';
import { searchGoogleBooks, fetchGoogleBookByIsbn } from './google-books';
import { searchOpenLibrary, fetchOpenLibraryByIsbn } from './open-library';

export async function searchExternalBooks(query: string): Promise<ExternalBookCandidate[]> {
  const [googleResults, olResults] = await Promise.allSettled([
    searchGoogleBooks(query),
    searchOpenLibrary(query),
  ]);

  const google = googleResults.status === 'fulfilled' ? googleResults.value : [];
  const ol = olResults.status === 'fulfilled' ? olResults.value : [];

  return mergeByIsbn([...google, ...ol]);
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
