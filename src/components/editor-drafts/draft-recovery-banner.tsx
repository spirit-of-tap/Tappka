'use client';

import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatWordCount } from '@/lib/essays/text-stats';

interface DraftRecoveryBannerProps {
  savedAt: string;
  /** Shown as "· 120 slov" when provided and non-zero. */
  wordCount?: number;
  onRestore: () => void;
  onDiscard: () => void;
}

/** "z 14:32" for a same-day draft, "z 18. 11. 09:05" once it crosses midnight. */
export function formatDraftTime(savedAt: string, now = new Date()): string {
  const saved = new Date(savedAt);
  const time = saved.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  if (saved.toDateString() === now.toDateString()) return time;
  const date = saved.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
  return `${date} ${time}`;
}

/** Notice above an editor offering to recover a draft saved in this browser. */
export function DraftRecoveryBanner({ savedAt, wordCount, onRestore, onDiscard }: DraftRecoveryBannerProps) {
  const showWordCount = wordCount !== undefined && wordCount > 0;

  return (
    <div
      role="status"
      aria-label="Nalezen rozepsaný text"
      className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <History className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">Máš rozepsaný text z {formatDraftTime(savedAt)}</p>
          <p className="text-xs text-muted-foreground">
            {showWordCount ? `${formatWordCount(wordCount)} · ` : ''}
            Neuložený text zůstal v tomto prohlížeči.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        <Button size="sm" onClick={onRestore}>Obnovit</Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>Zahodit</Button>
      </div>
    </div>
  );
}
