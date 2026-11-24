import { describe, expect, it } from 'vitest';
import { getEssayStatus } from './essay-status';
import type { EssayWithDetails } from './types';

function essay(overrides: Partial<EssayWithDetails>): EssayWithDetails {
  return {
    id: 'e',
    published_at: '2026-10-01T10:00:00Z',
    frozen_book_points: null,
    book: null,
    content_source: null,
    ...overrides,
  } as EssayWithDetails;
}

const book = (list_status: string) =>
  ({ id: 'b', title_cs: 'K', author: 'A', book_points: 2, list_status }) as EssayWithDetails['book'];

describe('getEssayStatus', () => {
  it('marks an unpublished essay as a draft', () => {
    expect(getEssayStatus(essay({ published_at: null, book: book('longlist') }))?.kind).toBe('draft');
  });

  it('follows the book review', () => {
    expect(getEssayStatus(essay({ book: book('processing') }))).toEqual({ kind: 'pending', label: 'Čeká na kouče:ku' });
    expect(getEssayStatus(essay({ book: book('shortlist') }))).toEqual({ kind: 'approved', label: 'Schváleno' });
    expect(getEssayStatus(essay({ book: book('longlist') }))?.kind).toBe('approved');
    expect(getEssayStatus(essay({ book: book('archived') }))?.kind).toBe('rejected');
  });

  it('follows the content source review', () => {
    const source = (status: string) =>
      ({ id: 's', kind: 'podcast', title: 'T', creator: null, points: 1, status }) as EssayWithDetails['content_source'];
    expect(getEssayStatus(essay({ content_source: source('pending_review') }))?.kind).toBe('pending');
    expect(getEssayStatus(essay({ content_source: source('approved') }))?.kind).toBe('approved');
  });

  it('treats frozen legacy credit as approved, even for an archived book', () => {
    expect(getEssayStatus(essay({ frozen_book_points: '1', book: book('archived') }))?.kind).toBe('approved');
  });

  it('has no status for an essay without a source', () => {
    expect(getEssayStatus(essay({}))).toBeNull();
  });
});
