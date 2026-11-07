import { describe, expect, it } from "vitest";

import { PLAYBOOK_CHAPTERS, getChapterBySlug } from "./content";

describe("PLAYBOOK_CHAPTERS", () => {
  it("has unique slugs", () => {
    const slugs = PLAYBOOK_CHAPTERS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every chapter has a title and non-empty sections", () => {
    for (const chapter of PLAYBOOK_CHAPTERS) {
      expect(chapter.title.length).toBeGreaterThan(0);
      expect(chapter.sections.length).toBeGreaterThan(0);
    }
  });

  it("resolves chapters by slug and returns null for unknown slugs", () => {
    expect(getChapterBySlug(PLAYBOOK_CHAPTERS[0].slug)).toBe(PLAYBOOK_CHAPTERS[0]);
    expect(getChapterBySlug("neexistuje")).toBeNull();
  });
});
