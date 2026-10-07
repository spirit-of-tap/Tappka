import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import type { EssayWithDetails } from '@/lib/essays/types';
import { normalizeSearchString } from '@/lib/spotlight';

/**
 * Case- and diacritics-insensitive filter over the author's own essays:
 * every query word must appear in the title, source (book title/author,
 * content source) or essay text.
 */
export function filterMyEssays(essays: EssayWithDetails[], query: string): EssayWithDetails[] {
  const words = normalizeSearchString(query).split(' ').filter(Boolean);
  if (words.length === 0) return essays;

  return essays.filter((essay) => {
    const haystack = normalizeSearchString(
      [
        essay.title,
        essay.book?.title_cs,
        essay.book?.author,
        getEssaySourceDisplay(essay).title,
        essay.content_text,
      ]
        .filter(Boolean)
        .join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
}
