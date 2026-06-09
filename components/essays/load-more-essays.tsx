'use client';

import { useEffect, useRef, useState } from 'react';
import { EssayCard } from './essay-card';
import { Spinner } from '@/components/ui/spinner';
import type { EssayWithDetails } from '@/lib/essays/types';

interface LoadMoreEssaysProps {
  initialPage: number;
  view: 'vse' | 'moje' | 'tym';
  teamId?: string;
  q?: string;
  sort?: 'recent' | 'week' | 'best';
  tag?: string;
  showVoteButton?: boolean;
}

export function LoadMoreEssays({ initialPage, view, teamId, q, sort, tag, showVoteButton = false }: LoadMoreEssaysProps) {
  const [essays, setEssays] = useState<EssayWithDetails[]>([]);
  const [page, setPage] = useState(initialPage + 1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const buildUrl = (p: number) => {
    const params = new URLSearchParams({ page: String(p), view });
    if (teamId) params.set('team_id', teamId);
    if (q) params.set('q', q);
    if (sort) params.set('sort', sort);
    if (tag) params.set('tag', tag);
    return `/api/essays?${params}`;
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
        setEssays((prev) => [...prev, ...data]);
        setPage((p) => p + 1);
        if (data.length < 20) setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEssays([]);
    setPage(initialPage + 1);
    setHasMore(true);
  }, [view, teamId, initialPage, q, sort, tag]);

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
  }, [page, loading, hasMore, view, teamId, q, sort, tag]);

  return (
    <>
      {essays.map((essay) => (
        <EssayCard key={essay.id} essay={essay} showVoteButton={showVoteButton} />
      ))}
      <div ref={sentinelRef} className="col-span-full flex justify-center py-4">
        {loading && <Spinner className="size-5" />}
      </div>
    </>
  );
}
