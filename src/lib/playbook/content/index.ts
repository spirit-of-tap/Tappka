import { FUNGOVANI_PRINCIPY } from "./fungovani-principy";
import { KOMUNIKACNI_STRUKTURA } from "./komunikacni-struktura";
import { OBECNE_INFORMACE } from "./obecne-informace";

import type { PlaybookChapter } from "../types";

export const PLAYBOOK_CHAPTERS: readonly PlaybookChapter[] = [
  OBECNE_INFORMACE,
  KOMUNIKACNI_STRUKTURA,
  FUNGOVANI_PRINCIPY,
];

export function getChapterBySlug(slug: string): PlaybookChapter | null {
  return PLAYBOOK_CHAPTERS.find((c) => c.slug === slug) ?? null;
}
