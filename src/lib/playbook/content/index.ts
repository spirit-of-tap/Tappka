import { FUNGOVANI_PRINCIPY } from "./fungovani-principy";
import { KOMUNIKACNI_STRUKTURA } from "./komunikacni-struktura";
import { METRIKY } from "./metriky";
import { OBECNE_INFORMACE } from "./obecne-informace";
import { STUDIUM_ROZVOJ } from "./studium-rozvoj";
import { TRP_LC } from "./trp-lc";
import { UCHAZECI_STUDENTI } from "./uchazeci-studenti";

import type { PlaybookChapter } from "../types";

export const PLAYBOOK_CHAPTERS: readonly PlaybookChapter[] = [
  OBECNE_INFORMACE,
  KOMUNIKACNI_STRUKTURA,
  FUNGOVANI_PRINCIPY,
  TRP_LC,
  UCHAZECI_STUDENTI,
  METRIKY,
  STUDIUM_ROZVOJ,
];

export function getChapterBySlug(slug: string): PlaybookChapter | null {
  return PLAYBOOK_CHAPTERS.find((c) => c.slug === slug) ?? null;
}
