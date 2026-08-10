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

  it('lists every thematic tag verbatim so the model cannot invent one', () => {
    for (const tag of BOOK_CATEGORIES) {
      expect(prompt).toContain(tag);
    }
  });

  it('carries the ego/manipulation override with its canonical example', () => {
    expect(prompt).toContain('48 zákonů moci');
    expect(prompt).toMatch(/nikdy.*kategorie 3/i);
  });

  it('carries the resilience override', () => {
    expect(prompt).toMatch(/stoicis/i);
    expect(prompt).toMatch(/odolnost/i);
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
