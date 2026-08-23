'use client';

import { useMemo } from 'react';
import { diffWordsWithSpace } from 'diff';
import { cn } from '@/lib/utils';

interface EssayVisualDiffProps {
  oldText: string;
  newText: string;
  className?: string;
  oldVersionLabel?: string;
  newVersionLabel?: string;
}

export function EssayVisualDiff({
  oldText,
  newText,
  className,
  oldVersionLabel = 'Před komentářem',
  newVersionLabel = 'Aktuální verze',
}: EssayVisualDiffProps) {
  const diffParts = useMemo(() => {
    return diffWordsWithSpace(oldText ?? '', newText ?? '');
  }, [oldText, newText]);

  const stats = useMemo(() => {
    let addedWords = 0;
    let removedWords = 0;

    for (const part of diffParts) {
      const words = part.value.trim().split(/\s+/).filter(Boolean).length;
      if (part.added) addedWords += words;
      if (part.removed) removedWords += words;
    }

    return { addedWords, removedWords };
  }, [diffParts]);

  const hasChanges = stats.addedWords > 0 || stats.removedWords > 0;

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 sm:p-6 shadow-xs leading-relaxed text-sm space-y-4',
        className,
      )}
    >
      {/* Diff Header with Legend & Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">
            Změny: {oldVersionLabel} → {newVersionLabel}
          </span>
          {hasChanges && (
            <span className="flex items-center gap-1.5 font-medium tabular-nums">
              {stats.addedWords > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{stats.addedWords} {stats.addedWords === 1 ? 'slovo' : stats.addedWords < 5 ? 'slova' : 'slov'}
                </span>
              )}
              {stats.addedWords > 0 && stats.removedWords > 0 && (
                <span className="text-muted-foreground">·</span>
              )}
              {stats.removedWords > 0 && (
                <span className="text-rose-600 dark:text-rose-400">
                  −{stats.removedWords} {stats.removedWords === 1 ? 'slovo' : stats.removedWords < 5 ? 'slova' : 'slov'}
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded bg-emerald-500" />
            <span className="font-medium text-emerald-700 dark:text-emerald-300">Přidáno</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded bg-rose-500" />
            <span className="font-medium text-rose-700 dark:text-rose-300">Odebráno</span>
          </span>
        </div>
      </div>

      {/* Diff Content View */}
      {hasChanges ? (
        <div className="whitespace-pre-wrap break-words leading-relaxed text-foreground/90 font-serif sm:text-base">
          {diffParts.map((part, index) => {
            if (part.added) {
              return (
                <mark
                  key={index}
                  className="rounded bg-emerald-500/20 px-0.5 py-0.2 text-emerald-950 dark:bg-emerald-500/30 dark:text-emerald-100 font-sans font-medium"
                >
                  {part.value}
                </mark>
              );
            }
            if (part.removed) {
              return (
                <del
                  key={index}
                  className="rounded bg-rose-500/15 px-0.5 py-0.2 text-rose-950 dark:bg-rose-500/25 dark:text-rose-200 line-through opacity-75 font-sans"
                >
                  {part.value}
                </del>
              );
            }
            return <span key={index}>{part.value}</span>;
          })}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">
          V textu nebyly nalezeny žádné změny oproti předchozí verzi.
        </p>
      )}
    </div>
  );
}
