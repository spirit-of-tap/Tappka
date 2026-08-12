import { describe, expect, it } from 'vitest';

import { parseEnrichment } from './schema';

const VALID = {
  title_cs: 'Sprint',
  title_en: 'Sprint',
  author: 'Jake Knapp',
  isbn_13: '9781501121746',
  page_count: 288,
  description: 'Naučíš se během pěti dnů otestovat nápad. Je to hutné a hodně procesní.',
  tag: 'Inovace & kreativita',
  suggested_points: 2,
  points_reason: 'Kategorie 2 — procesní manuál s konkrétními frameworky, 288 stran.',
  confidence: 'high',
};

describe('parseEnrichment', () => {
  it('accepts a well-formed payload', () => {
    const result = parseEnrichment(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.suggested_points).toBe(2);
  });

  it('accepts nulls for the optional metadata', () => {
    const result = parseEnrichment({ ...VALID, title_en: null, isbn_13: null, page_count: null });
    expect(result.ok).toBe(true);
  });

  it('rejects a tag outside the eight thematic categories', () => {
    // A student cannot INSERT into `tags` (RLS requires is_coach_or_admin), so an
    // invented tag name would fail at write time. Reject it here instead.
    const result = parseEnrichment({ ...VALID, tag: 'Beletrie' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/tag/);
  });

  it('accepts 0 for irrelevant books and rejects values outside 0-3', () => {
    expect(parseEnrichment({ ...VALID, suggested_points: 0 }).ok).toBe(true);
    expect(parseEnrichment({ ...VALID, suggested_points: -1 }).ok).toBe(false);
    expect(parseEnrichment({ ...VALID, suggested_points: 4 }).ok).toBe(false);
  });

  it('rejects a missing description or points_reason', () => {
    expect(parseEnrichment({ ...VALID, description: '' }).ok).toBe(false);
    expect(parseEnrichment({ ...VALID, points_reason: '   ' }).ok).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(parseEnrichment(null).ok).toBe(false);
    expect(parseEnrichment('{}').ok).toBe(false);
  });

  it('defaults an unrecognised confidence to low rather than failing', () => {
    const result = parseEnrichment({ ...VALID, confidence: 'medium' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.confidence).toBe('low');
  });

  it('collects the uncertain fields, deduped and filtered to known names', () => {
    const result = parseEnrichment({
      ...VALID,
      confidence: 'low',
      low_confidence_fields: ['author', 'author', 'page_count', 'made_up_field'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.low_confidence_fields).toEqual(['author', 'page_count']);
    }
  });

  it('defaults low_confidence_fields to an empty list when the model omits it', () => {
    const result = parseEnrichment(VALID);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.low_confidence_fields).toEqual([]);
  });
});
