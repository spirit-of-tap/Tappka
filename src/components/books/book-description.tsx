'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export function BookDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 320;

  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          'max-w-prose whitespace-pre-line text-sm leading-relaxed text-foreground/80',
          isLong && !expanded && 'line-clamp-6',
        )}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {expanded ? 'Zobrazit méně' : 'Zobrazit více'}
        </button>
      )}
    </div>
  );
}
