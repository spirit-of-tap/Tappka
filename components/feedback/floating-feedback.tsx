'use client';

import { Heart, MessageSquareHeart } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function FloatingFeedback() {
  return (
    <Link
      href="/zpetna-vazba"
      className={cn(
        'group fixed bottom-20 right-5 z-40 flex items-center gap-2',
        'rounded-full border border-rose-200/60 bg-rose-50/90 px-4 py-2.5',
        'text-rose-700 shadow-sm backdrop-blur-sm',
        'dark:border-rose-800/40 dark:bg-rose-950/80 dark:text-rose-300',
        'hover:bg-rose-100 hover:text-rose-800 hover:shadow-md',
        'dark:hover:bg-rose-900/70 dark:hover:text-rose-200',
        'transition-all duration-300',
      )}
    >
      <Heart className="size-4 animate-pulse transition-transform group-hover:scale-110" />
      <span className="text-sm font-medium">Zpětná vazba</span>
    </Link>
  );
}
