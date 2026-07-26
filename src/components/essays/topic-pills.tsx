'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BOOK_CATEGORY_LABELS } from '@/lib/books/types';

const TOPICS = Object.keys(BOOK_CATEGORY_LABELS);

export function TopicPills() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get('tag') ?? '';

  const setTag = (tag: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tag === activeTag) {
      params.delete('tag');
    } else {
      params.set('tag', tag);
    }
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {TOPICS.map((tag) => (
        <button
          key={tag}
          onClick={() => setTag(tag)}
          className={cn(
            'shrink-0 text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap',
            activeTag === tag
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground',
          )}
        >
          {BOOK_CATEGORY_LABELS[tag as keyof typeof BOOK_CATEGORY_LABELS]}
        </button>
      ))}
    </div>
  );
}
