import { FUNGOVANI_PRINCIPY } from "./fungovani-principy";
import { KOMUNIKACNI_STRUKTURA } from "./komunikacni-struktura";
import { OBECNE_INFORMACE } from "./obecne-informace";
import { TRP_LC } from "./trp-lc";
import { UCHAZECI_STUDENTI } from "./uchazeci-studenti";

import type { PlaybookChapter } from "../types";

export const PLAYBOOK_CHAPTERS: readonly PlaybookChapter[] = [
  OBECNE_INFORMACE,
  KOMUNIKACNI_STRUKTURA,
  FUNGOVANI_PRINCIPY,
  TRP_LC,
  UCHAZECI_STUDENTI,
];

export function getChapterBySlug(slug: string): PlaybookChapter | null {
  return PLAYBOOK_CHAPTERS.find((c) => c.slug === slug) ?? null;
}
