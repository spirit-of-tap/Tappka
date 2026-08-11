import type { EnrichedBook } from '@/lib/books/enrichment/schema';
import type { ExternalBookCandidate } from '@/lib/books/types';

/** The working record as it moves through the four steps. Mirrored to sessionStorage. */
export interface AddBookDraft {
  candidate: ExternalBookCandidate | null;
  enriched: EnrichedBook | null;
  citations: string[];
  /** True when the submitter is filling the record in by hand. */
  manual: boolean;
}

export const EMPTY_DRAFT: AddBookDraft = {
  candidate: null,
  enriched: null,
  citations: [],
  manual: false,
};

/** Things that must never be added, from the 2026-07-27 curation pass. */
export const DOES_NOT_BELONG = [
  'Duplicity — kniha, která už v BOBovi je pod jiným jazykem nebo vydáním',
  'Ne-knihy — články, kurzy, podcasty, PDF příručky',
  'Pseudověda',
  'Beletrie',
  'Knihy v rozporu s našimi hodnotami',
] as const;
