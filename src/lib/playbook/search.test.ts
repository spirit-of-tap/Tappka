import { describe, expect, it } from "vitest";

import { PLAYBOOK_CHAPTERS } from "./content";
import { buildPlaybookIndex, normalizePlaybookText, searchPlaybook } from "./search";

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
