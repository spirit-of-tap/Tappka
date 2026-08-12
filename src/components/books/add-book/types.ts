import { BookMarked, FileText, HeartCrack, UtensilsCrossed, Wand2, type LucideIcon } from 'lucide-react';

import type { EnrichedBook } from '@/lib/books/enrichment/schema';
import type { ExternalBookCandidate } from '@/lib/books/types';

/** The working record as it moves through the flow. Mirrored to sessionStorage. */
export interface AddBookDraft {
  candidate: ExternalBookCandidate | null;
  enriched: EnrichedBook | null;
  citations: string[];
  /** True when the submitter is filling the record in by hand. */
  manual: boolean;
  /**
   * True when the AI refused the book and the submitter chose to send it anyway.
   * Krok 4 then asks for an argument instead of a description.
   */
  appealing: boolean;
}

export const EMPTY_DRAFT: AddBookDraft = {
  candidate: null,
  enriched: null,
  citations: [],
  manual: false,
  appealing: false,
};

interface RejectionChip {
  icon: LucideIcon;
  label: string;
}

/**
 * What never belongs in BOB, from the 2026-07-27 curation pass, as chips rather
 * than sentences — nobody reads a bulleted list on a screen they want past.
 *
 * Duplicates are absent on purpose: Krok 2 catches them against the real
 * catalogue, which works better than warning about them here ever could.
 */
export const DOES_NOT_BELONG_CHIPS: readonly RejectionChip[] = [
  { icon: BookMarked, label: 'Beletrie' },
  { icon: Wand2, label: 'Pseudověda' },
  { icon: UtensilsCrossed, label: 'Nesouvisí s podnikáním' },
  { icon: FileText, label: 'Články, kurzy, PDF' },
  { icon: HeartCrack, label: 'V rozporu s našimi hodnotami' },
] as const;
