import { describe, expect, it } from 'vitest';

import { BOOK_CATEGORIES } from '@/lib/books/types';

import { BOOK_POINT_CATEGORIES, buildSystemPrompt } from './rubric';

describe('BOOK_POINT_CATEGORIES', () => {
  it('describes exactly the three scoring categories, one per point value', () => {
    expect(BOOK_POINT_CATEGORIES.map((c) => c.points)).toEqual([1, 2, 3]);
    for (const category of BOOK_POINT_CATEGORIES) {
      expect(category.name.length).toBeGreaterThan(0);
      expect(category.description.length).toBeGreaterThan(0);
      expect(category.examples.length).toBeGreaterThan(0);
    }
  });
});

describe('buildSystemPrompt', () => {
  const prompt = buildSystemPrompt();

  // Both overrides invert the plain category reading, so each assertion is
  // scoped to the prompt section that carries it. A prompt-wide `toMatch` would
  // pass on coincidental matches elsewhere and would break on a reflow.
  const sectionContaining = (pattern: RegExp): string => {
    const section = prompt.split('\n\n').find((part) => pattern.test(part));
    expect(section).toBeDefined();
    return section as string;
  };

  it('lists every thematic tag verbatim so the model cannot invent one', () => {
    for (const tag of BOOK_CATEGORIES) {
      expect(prompt).toContain(tag);
    }
  });

  it('carries the ego/manipulation override, forcing category 1 not 3', () => {
    const override = sectionContaining(/48 zákonů moci/);

    expect(override).toMatch(/NIKDY/);
    expect(override).toMatch(/Kategorie 3/);
    expect(override).toMatch(/Kategorie 1/);
    expect(override).toMatch(/1 bod/);
  });

  it('carries the resilience override, awarding 2 points rather than 1', () => {
    const override = sectionContaining(/stoicis/i);

    expect(override).toMatch(/odolnost/i);
    expect(override).toMatch(/Kategorie 1/);
    // The whole content of this rule is the number. Without it the test would
    // pass on a prompt that awarded 1 point.
    expect(override).toMatch(/2 body/);
  });

  it('explains the extent correction with both worked examples', () => {
    expect(prompt).toMatch(/50/);
    expect(prompt).toMatch(/800/);
  });

  it('defines the school slang the voice depends on', () => {
    expect(prompt).toContain('Téčko');
    expect(prompt).toContain('Book of Books');
  });
});
