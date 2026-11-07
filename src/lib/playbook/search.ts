import MiniSearch, { type Options as MiniSearchOptions, type SearchOptions } from "minisearch";

import type { PlaybookBlock, PlaybookChapter } from "./types";

export interface PlaybookSearchResult {
  chapterSlug: string;
  chapterTitle: string;
  sectionSlug: string;
  sectionTitle: string;
  /** Plain text around the first match; the UI renders <mark> highlighting. */
  snippet: string;
}

/** Document shape stored in the MiniSearch index (mirrors storeFields). */
interface SearchDoc {
  id: string;
  chapterSlug: string;
  chapterTitle: string;
  sectionSlug: string;
  sectionTitle: string;
  title: string;
  text: string;
}

const MINISEARCH_OPTIONS: MiniSearchOptions = {
  idField: "id",
  // `title` duplicates `sectionTitle` on purpose — it is the boosted field.
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
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 20;

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

export function buildPlaybookIndex(chapters: readonly PlaybookChapter[]): MiniSearch<SearchDoc> {
  const index = new MiniSearch<SearchDoc>(MINISEARCH_OPTIONS);
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

export function searchPlaybook(index: MiniSearch<SearchDoc>, query: string): PlaybookSearchResult[] {
  const normalized = normalizePlaybookText(query.trim());
  if (normalized.length < MIN_QUERY_LENGTH) return [];

  const results = index.search(normalized, SEARCH_OPTIONS);
  return results.slice(0, MAX_RESULTS).map(({ text, chapterSlug, chapterTitle, sectionSlug, sectionTitle }) => {
    // Positions in textLower map 1:1 onto `text` because the content is
    // precomposed (NFD + diacritic strip keeps code-unit counts per char).
    const textLower = normalizePlaybookText(text);
    const terms = normalized.split(/\s+/).filter((term) => term.length >= MIN_QUERY_LENGTH);
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
