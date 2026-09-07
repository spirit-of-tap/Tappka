import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchGoogleBookById, refetchGoogleBookData, searchGoogleBooks } from './google-books';

function mockFetchOnce(body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchGoogleBooks', () => {
  it('maps page count, publisher, year and preview link', async () => {
    mockFetchOnce({
      items: [{
        id: 'vol-1',
        volumeInfo: {
          title: 'Sprint',
          authors: ['Jake Knapp'],
          publisher: 'Simon & Schuster',
          publishedDate: '2016-03-08',
          pageCount: 288,
          previewLink: 'https://books.google.com/preview',
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781501121746' }],
          imageLinks: { thumbnail: 'http://example.com/c.jpg' },
        },
      }],
    });

    const [candidate] = await searchGoogleBooks('sprint');

    expect(candidate.page_count).toBe(288);
    expect(candidate.publisher).toBe('Simon & Schuster');
    expect(candidate.published_year).toBe(2016);
    expect(candidate.preview_link).toBe('https://books.google.com/preview');
    expect(candidate.cover_url).toBe('https://example.com/c.jpg');
  });

  it('returns nulls for the new fields when the volume omits them', async () => {
    mockFetchOnce({ items: [{ id: 'vol-2', volumeInfo: { title: 'Bez detailů' } }] });

    const [candidate] = await searchGoogleBooks('bez');

    expect(candidate.page_count).toBeNull();
    expect(candidate.publisher).toBeNull();
    expect(candidate.published_year).toBeNull();
    expect(candidate.preview_link).toBeNull();
    expect(candidate.author).toBe('Neznámý autor');
  });

  it('parses a year-only publishedDate', async () => {
    mockFetchOnce({
      items: [{ id: 'vol-3', volumeInfo: { title: 'Jen rok', publishedDate: '1999' } }],
    });

    const [candidate] = await searchGoogleBooks('rok');

    expect(candidate.published_year).toBe(1999);
  });
});

describe('fetchGoogleBookById', () => {
  it('fetches and normalizes a single volume by id', async () => {
    mockFetchOnce({
      id: 'vol-xyz',
      volumeInfo: {
        title: 'Deep Work',
        authors: ['Cal Newport'],
        previewLink: 'https://books.google.com/preview/deep-work',
        imageLinks: { thumbnail: 'http://books.google.com/deepwork.jpg' },
      },
    });

    const candidate = await fetchGoogleBookById('vol-xyz');
    expect(candidate).not.toBeNull();
    expect(candidate?.title).toBe('Deep Work');
    expect(candidate?.cover_url).toBe('https://books.google.com/deepwork.jpg');
    expect(candidate?.preview_link).toBe('https://books.google.com/preview/deep-work');
    expect(candidate?.external_id).toBe('vol-xyz');
  });
});

describe('refetchGoogleBookData', () => {
  it('prefers externalId when present', async () => {
    mockFetchOnce({
      id: 'vol-preferred',
      volumeInfo: {
        title: 'Sprint',
        authors: ['Jake Knapp'],
        previewLink: 'https://books.google.com/preview/sprint',
        imageLinks: { thumbnail: 'https://books.google.com/sprint.jpg' },
      },
    });

    const result = await refetchGoogleBookData({
      externalId: 'vol-preferred',
      title: 'Sprint',
      author: 'Jake Knapp',
    });

    expect(result?.external_id).toBe('vol-preferred');
    expect(result?.cover_url).toBe('https://books.google.com/sprint.jpg');
    expect(result?.preview_link).toBe('https://books.google.com/preview/sprint');
  });

  it('falls back to search when externalId is absent', async () => {
    mockFetchOnce({
      items: [{
        id: 'vol-searched',
        volumeInfo: {
          title: 'Sprint',
          authors: ['Jake Knapp'],
          previewLink: 'https://books.google.com/preview/sprint-found',
          imageLinks: { thumbnail: 'https://books.google.com/sprint-found.jpg' },
        },
      }],
    });

    const result = await refetchGoogleBookData({
      title: 'Sprint',
      author: 'Jake Knapp',
    });

    expect(result?.external_id).toBe('vol-searched');
    expect(result?.cover_url).toBe('https://books.google.com/sprint-found.jpg');
    expect(result?.preview_link).toBe('https://books.google.com/preview/sprint-found');
  });
});

