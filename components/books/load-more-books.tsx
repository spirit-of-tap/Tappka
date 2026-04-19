'use client';

import { useEffect, useRef, useState } from 'react';
import { BookCard } from './book-card';
import { Spinner } from '@/components/ui/spinner';
import type { BookWithProfiles } from '@/lib/books/types';

interface LoadMoreBooksProps {
  initialPage: number;   // page already rendered server-side (usually 1)
  searchParams: { q?: string; tag?: string | string[] };
}

export function LoadMoreBooks({ initialPage, searchParams }: LoadMoreBooksProps) {
  const [books, setBooks] = useState<BookWithProfiles[]>([]);
  const [page, setPage] = useState(initialPage + 1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildUrl = (p: number) => {
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('sort', 'popular');
    if (searchParams.q) params.set('q', searchParams.q);
    const tags = Array.isArray(searchParams.tag)
      ? searchParams.tag
      : searchParams.tag ? [searchParams.tag] : [];
    tags.forEach((t) => params.append('tag', t));
    return `/api/books?${params}`;
  };

  const loadMore = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(buildUrl(page));
      const { data } = await res.json();
      if (!data || data.length === 0) {
        setHasMore(false);
      } else {
        setBooks((prev) => [...prev, ...data]);
        setPage((p) => p + 1);
        if (data.length < 20) setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset when search params change
  useEffect(() => {
    setBooks([]);
    setPage(initialPage + 1);
    setHasMore(true);
  }, [searchParams.q, searchParams.tag, initialPage]);

  // IntersectionObserver — fire loadMore when sentinel scrolls into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, loading, hasMore, searchParams.q, searchParams.tag]);

  return (
    <>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
      <div ref={sentinelRef} className="col-span-full flex justify-center py-4">
        {loading && <Spinner className="size-5" />}
      </div>
    </>
  );
}
