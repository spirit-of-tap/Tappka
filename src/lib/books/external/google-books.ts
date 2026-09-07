import type { ExternalBookCandidate } from '../types';
import { serverLogger } from "@/lib/server-logger";

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    previewLink?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

interface GoogleBooksResponse {
  items?: GoogleBooksVolume[];
}

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const MAX_RESULTS = 10;

/** Google Books returns `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. */
function parseYear(publishedDate: string | undefined): number | null {
  if (!publishedDate) return null;
  const year = Number.parseInt(publishedDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

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
    page_count: info.pageCount ?? null,
    publisher: info.publisher ?? null,
    published_year: parseYear(info.publishedDate),
    preview_link: info.previewLink ?? null,
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
    serverLogger.console.error(`Google Books API error ${res.status}:`, body);
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

export async function fetchGoogleBookById(volumeId: string): Promise<ExternalBookCandidate | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams();
  if (apiKey) params.set('key', apiKey);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${BASE_URL}/${encodeURIComponent(volumeId)}${qs}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;

  const json = (await res.json()) as GoogleBooksVolume;
  return normalizeVolume(json);
}

export interface RefetchGoogleBookParams {
  externalId?: string | null;
  isbn?: string | null;
  title: string;
  author: string;
}

export async function refetchGoogleBookData(
  params: RefetchGoogleBookParams,
): Promise<ExternalBookCandidate | null> {
  // 1. Try by volume ID if provided
  if (params.externalId?.trim()) {
    const byId = await fetchGoogleBookById(params.externalId.trim());
    if (byId && (byId.cover_url ?? byId.preview_link)) {
      return byId;
    }
  }

  // 2. Try by ISBN if provided
  const isbn = params.isbn?.replace(/[^0-9X]/gi, '');
  if (isbn) {
    const byIsbn = await fetchGoogleBookByIsbn(isbn);
    if (byIsbn && (byIsbn.cover_url ?? byIsbn.preview_link)) {
      return byIsbn;
    }
  }

  // 3. Try targeted title + author search
  const cleanTitle = params.title.trim();
  const cleanAuthor = params.author.trim();
  if (cleanTitle) {
    const targetedQuery = cleanAuthor
      ? `intitle:${cleanTitle} inauthor:${cleanAuthor}`
      : `intitle:${cleanTitle}`;
    const targeted = await searchGoogleBooks(targetedQuery);
    const bestTargeted = targeted.find((c) => c.cover_url ?? c.preview_link) ?? targeted[0];
    if (bestTargeted) return bestTargeted;

    // 4. Fallback to broad query
    const broadQuery = cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle;
    const broad = await searchGoogleBooks(broadQuery);
    const bestBroad = broad.find((c) => c.cover_url ?? c.preview_link) ?? broad[0];
    if (bestBroad) return bestBroad;
  }

  return null;
}

