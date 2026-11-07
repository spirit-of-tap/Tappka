import MiniSearch, { type Options as MiniSearchOptions, type SearchOptions } from "minisearch";

import type { PlaybookBlock, PlaybookChapter } from "./types";

export interface PlaybookSearchResult {
  chapterSlug: string;
  chapterTitle: string;
  sectionSlug: string;
  sectionTitle: string;
  /** Text around the first match, ready to render with <mark> segments. */
  snippet: string;
}

const MINISEARCH_OPTIONS: MiniSearchOptions = {
  idField: "id",
  fields: ["title", "chapterTitle", "text"],
  storeFields: ["chapterSlug", "chapterTitle", "sectionSlug", "sectionTitle", "text"],
  // Folds diacritics on both indexed terms and query terms, so searches are
  // accent-insensitive end to end.
  processTerm: (term) => normalizePlaybookText(term),
};

const SEARCH_OPTIONS: SearchOptions = {
  prefix: true,
  fuzzy: 0.2,
  boost: { title: 2, chapterTitle: 1.2 },
};

const SNIPPET_RADIUS = 120;

export function normalizePlaybookText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function sectionText(blocks: PlaybookBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "paragraph":
        case "note":
        case "heading":
          return block.text;
        case "list":
          return block.items.join(" ");
        case "table":
          return [block.headers.join(" "), ...block.rows.map((row) => row.join(" "))].join(" ");
      }
    })
    .join("\n");
}

export function buildPlaybookIndex(chapters: readonly PlaybookChapter[]): MiniSearch {
  const index = new MiniSearch(MINISEARCH_OPTIONS);
  index.addAll(
    chapters.flatMap((chapter) =>
      chapter.sections.map((section) => ({
        id: `${chapter.slug}/${section.slug}`,
        chapterSlug: chapter.slug,
        chapterTitle: chapter.title,
        sectionSlug: section.slug,
        sectionTitle: section.title,
        title: section.title,
        text: sectionText(section.blocks),
      })),
    ),
  );
  return index;
}

export function searchPlaybook(index: MiniSearch, query: string): PlaybookSearchResult[] {
  const normalized = normalizePlaybookText(query.trim());
  if (normalized.length < 2) return [];

  const results = index.search(normalized, SEARCH_OPTIONS);
  return results.slice(0, 20).map((result) => {
    const text = result.text as string;
    const chapterSlug = result.chapterSlug as string;
    const chapterTitle = result.chapterTitle as string;
    const sectionSlug = result.sectionSlug as string;
    const sectionTitle = result.sectionTitle as string;

    const textLower = normalizePlaybookText(text);
    const terms = normalized.split(/\s+/).filter((term) => term.length >= 2);
    let hit = -1;
    for (const term of terms) {
      const indexInText = textLower.indexOf(term);
      if (indexInText !== -1 && (hit === -1 || indexInText < hit)) hit = indexInText;
    }

    const start = hit === -1 ? 0 : Math.max(0, hit - SNIPPET_RADIUS);
    const end =
      hit === -1
        ? Math.min(text.length, SNIPPET_RADIUS * 2)
        : Math.min(text.length, hit + SNIPPET_RADIUS);
    const snippet = `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;

    return { chapterSlug, chapterTitle, sectionSlug, sectionTitle, snippet };
  });
}
