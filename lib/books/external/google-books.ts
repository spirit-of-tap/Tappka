import type { ExternalBookCandidate } from '../types';

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

interface GoogleBooksResponse {
  items?: GoogleBooksVolume[];
}

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const MAX_RESULTS = 10;

function normalizeVolume(volume: GoogleBooksVolume): ExternalBookCandidate | null {
  const info = volume.volumeInfo;
  if (!info.title) return null;

  const isbn13 = info.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier ?? null;
  const author = info.authors?.join(', ') ?? 'Neznámý autor';
  const coverUrl = info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null;

  return {
    title: info.title,
    author,
    isbn_13: isbn13,
    description: info.description ?? null,
    cover_url: coverUrl,
    source: 'google_books',
    external_id: volume.id,
  };
}

export async function searchGoogleBooks(query: string): Promise<ExternalBookCandidate[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({ q: query, maxResults: String(MAX_RESULTS) });
  if (apiKey) params.set('key', apiKey);

  const res = await fetch(`${BASE_URL}?${params}`, { next: { revalidate: 60 } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`Google Books API error ${res.status}:`, body);
    return [];
  }

  const json = (await res.json()) as GoogleBooksResponse;
  return (json.items ?? []).map(normalizeVolume).filter(Boolean) as ExternalBookCandidate[];
}

export async function fetchGoogleBookByIsbn(isbn: string): Promise<ExternalBookCandidate | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({ q: `isbn:${isbn}`, maxResults: '1' });
  if (apiKey) params.set('key', apiKey);

  const res = await fetch(`${BASE_URL}?${params}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;

  const json = (await res.json()) as GoogleBooksResponse;
  const first = json.items?.[0];
  return first ? normalizeVolume(first) : null;
}
