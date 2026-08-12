import {
  BookMarked,
  Brain,
  FileText,
  HeartCrack,
  Puzzle,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wand2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

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
   * True when Tappka refused the book and the submitter chose to send it anyway.
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

interface GateChip {
  icon: LucideIcon;
  label: string;
}

/**
 * What we are looking for, named the way a submitter would describe a book to a
 * teammate — not by the scoring rubric's categories, which exist so the model
 * can pick a number and mean nothing to the person holding the book.
 */
export const BELONGS_CHIPS: readonly GateChip[] = [
  { icon: Wrench, label: 'Praktické manuály a how-to' },
  { icon: Puzzle, label: 'Systémové myšlení' },
  { icon: Users, label: 'Vedení a týmová spolupráce' },
  { icon: TrendingUp, label: 'Byznys a inovace' },
  { icon: Brain, label: 'Disciplína a odolnost' },
] as const;

/**
 * What never belongs in BOB, from the 2026-07-27 curation pass, as chips rather
 * than sentences — nobody reads a bulleted list on a screen they want past.
 *
 * Duplicates are absent on purpose: Krok 2 catches them against the real
 * catalogue, which works better than warning about them here ever could.
 */
export const DOES_NOT_BELONG_CHIPS: readonly GateChip[] = [
  { icon: BookMarked, label: 'Beletrie' },
  { icon: Wand2, label: 'Pseudověda' },
  { icon: UtensilsCrossed, label: 'Nesouvisí s podnikáním' },
  { icon: FileText, label: 'Články, kurzy, PDF' },
  { icon: HeartCrack, label: 'V rozporu s našimi hodnotami' },
] as const;
