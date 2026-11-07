import { describe, expect, it } from "vitest";

import { PLAYBOOK_CHAPTERS } from "./content";
import {
  buildPlaybookIndex,
  highlightPlaybookSnippet,
  normalizePlaybookText,
  searchPlaybook,
} from "./search";

const INDEX = buildPlaybookIndex(PLAYBOOK_CHAPTERS);

describe("normalizePlaybookText", () => {
  it("folds diacritics and lowercases", () => {
    expect(normalizePlaybookText("Přijímací řízení")).toBe("prijimaci rizeni");
  });

  it("keeps already-normalized text intact", () => {
    expect(normalizePlaybookText("Houston Calling 123")).toBe("houston calling 123");
  });
});

describe("buildPlaybookIndex", () => {
  it("indexes one document per section with ids like 'metriky/houston-calling-hc'", () => {
    const sectionCount = PLAYBOOK_CHAPTERS.reduce(
      (count, chapter) => count + chapter.sections.length,
      0,
    );

    expect(INDEX.documentCount).toBe(sectionCount);
    expect(INDEX.has("metriky/houston-calling-hc")).toBe(true);
  });
});

describe("searchPlaybook", () => {
  it("finds the Metriky chapter's Houston calling section for 'houston'", () => {
    const results = searchPlaybook(INDEX, "houston");
    const hit = results.find((r) => r.sectionSlug === "houston-calling-hc");

    expect(hit).toBeDefined();
    expect(hit?.chapterSlug).toBe("metriky");
    expect(hit?.chapterTitle).toBe("Metriky");
    expect(hit?.sectionTitle).toBe("Houston calling (HC)");
    expect(hit?.snippet).toContain("Houston");
  });

  it("returns an empty array for empty or short queries", () => {
    expect(searchPlaybook(INDEX, "")).toEqual([]);
    expect(searchPlaybook(INDEX, "   ")).toEqual([]);
    expect(searchPlaybook(INDEX, "a")).toEqual([]);
  });

  it("finds diacritics-bearing content with a diacritics-free query", () => {
    const results = searchPlaybook(INDEX, "prijimaci");
    const hit = results.find((r) => r.sectionTitle === "Přijímací řízení");

    expect(hit).toBeDefined();
    expect(hit?.chapterSlug).toBe("uchazeci-studenti");
    expect(hit?.snippet.toLowerCase()).toContain("přijímací");
  });
});

describe("highlightPlaybookSnippet", () => {
  it("marks the query term with its original casing", () => {
    expect(highlightPlaybookSnippet("Houston Calling, zkráceně HC", "houston")).toEqual([
      { text: "Houston", match: true },
      { text: " Calling, zkráceně HC", match: false },
    ]);
  });

  it("matches diacritics-insensitively but keeps the original text", () => {
    expect(highlightPlaybookSnippet("Přijímací řízení začíná v lednu", "prijimaci")).toEqual([
      { text: "Přijímací", match: true },
      { text: " řízení začíná v lednu", match: false },
    ]);
  });

  it("marks every term of a multi-term query", () => {
    expect(highlightPlaybookSnippet("Tým prezentuje projekt před komunitou", "tym projekt")).toEqual([
      { text: "Tým", match: true },
      { text: " prezentuje ", match: false },
      { text: "projekt", match: true },
      { text: " před komunitou", match: false },
    ]);
  });

  it("merges overlapping term ranges into one match", () => {
    expect(highlightPlaybookSnippet("houston houston", "houston hou")).toEqual([
      { text: "houston", match: true },
      { text: " ", match: false },
      { text: "houston", match: true },
    ]);
  });

  it("returns the snippet unchanged when nothing matches or the query is too short", () => {
    expect(highlightPlaybookSnippet("abc def", "xyz")).toEqual([{ text: "abc def", match: false }]);
    expect(highlightPlaybookSnippet("abc def", "x")).toEqual([{ text: "abc def", match: false }]);
    expect(highlightPlaybookSnippet("abc def", "  ")).toEqual([{ text: "abc def", match: false }]);
  });
});
