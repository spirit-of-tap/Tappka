import { OBECNE_INFORMACE } from "./obecne-informace";
import type { PlaybookChapter } from "../types";

export const PLAYBOOK_CHAPTERS: readonly PlaybookChapter[] = [
  OBECNE_INFORMACE,
];

export function getChapterBySlug(slug: string): PlaybookChapter | null {
  return PLAYBOOK_CHAPTERS.find((c) => c.slug === slug) ?? null;
}
