import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';
import { getEssays } from './queries';
import type { EssayWithDetails } from './types';

/** How many latest essays to show on a book card when the feed pools contain none of its essays. */
export const BOOK_ESSAY_FALLBACK_LIMIT = 2;

/** Minimal essay info rendered under a book card. Shape matches the card's `BookEssayItem`. */
export interface BookEssayPreview {
  id: string;
  title: string;
  author: {
    id: string;
    name: string | null;
    picture: string | null;
    team_id?: string | null;
  } | null;
}

export function toBookEssayPreview(essay: EssayWithDetails): BookEssayPreview {
  return {
    id: essay.id,
    title: essay.title,
    author: essay.author
      ? {
          id: essay.author.id,
          name: essay.author.name,
          picture: essay.author.picture,
          team_id: essay.author.team_id,
        }
      : null,
  };
}

/**
 * Merges fallback essays into the pool-built map. Pool essays always win —
 * fallback only fills books the pools missed, so cards never claim
 * "Zatím bez eseje" for books that actually have essays.
 */
export function mergeBookEssayMaps<T>(
  pool: Record<string, T[]>,
  fallback: Record<string, T[]>,
): Record<string, T[]> {
  return { ...fallback, ...pool };
}

/**
 * Loads the latest published essays for books that ended up with no essays
 * from the feed pools (e.g. all their essays are old and low-engagement).
 * Books with truly zero essays are left out.
 */
export async function getFallbackBookEssays(
  supabase: SupabaseClient<Database>,
  bookIds: string[],
  perBook: number = BOOK_ESSAY_FALLBACK_LIMIT,
): Promise<Record<string, BookEssayPreview[]>> {
  const uniqueIds = Array.from(new Set(bookIds));
  if (uniqueIds.length === 0) return {};

  const settled = await Promise.all(
    uniqueIds.map((bookId) => getEssays(supabase, { bookId, sort: 'recent', pageSize: perBook })),
  );

  const result: Record<string, BookEssayPreview[]> = {};
  settled.forEach((essays, index) => {
    if (essays.length > 0) {
      result[uniqueIds[index]] = essays.map(toBookEssayPreview);
    }
  });
  return result;
}
