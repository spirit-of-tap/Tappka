'use client';

import { useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TeamReadingListPanel } from './team-reading-list-card';
import type { TeamReadingList } from '@/lib/books/team-lists';
import { cn } from '@/lib/utils';

interface TeamReadingListsHeroProps {
  lists: TeamReadingList[];
  hasTeam: boolean;
}

export function TeamReadingListsHero({ lists, hasTeam }: TeamReadingListsHeroProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [localLists, setLocalLists] = useState(lists);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const create = async () => {
    if (!title.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/team-reading-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          month: new Date().toISOString().slice(0, 7),
        }),
      });
      if (res.ok) {
        const { data } = await res.json();
        const newList = { ...data, team: null, books: [] };
        setLocalLists((prev) => [newList, ...prev]);
        setCurrentIndex(0);
        setTitle('');
        setCreating(false);
      } else {
        setError('Nepodařilo se vytvořit seznam');
      }
    } finally {
      setLoading(false);
    }
  };

  if (localLists.length === 0 && !hasTeam) return null;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < localLists.length - 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Doporučené od týmů</h2>
        <div className="flex items-center gap-2">
          {localLists.length > 1 && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setCurrentIndex((i) => i - 1)}
                disabled={!hasPrev}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-default"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-xs text-muted-foreground tabular-nums w-8 text-center">
                {currentIndex + 1}/{localLists.length}
              </span>
              <button
                onClick={() => setCurrentIndex((i) => i + 1)}
                disabled={!hasNext}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-default"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
          {hasTeam && !creating && (
            <Button variant="ghost" size="sm" onClick={() => setCreating(true)} className="gap-1.5 h-7 text-xs">
              <Plus className="size-3.5" />
              Přidat seznam
            </Button>
          )}
        </div>
      </div>

      {creating && (
        <div className="space-y-1.5">
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Název seznamu…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              className="h-8 text-sm"
              autoFocus
            />
            <Button size="sm" onClick={create} disabled={loading || !title.trim()}>
              Vytvořit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              <X className="size-4" />
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {localLists.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Zatím žádné seznamy — přidej první pro svůj tým
        </p>
      ) : localLists[currentIndex] ? (
        <TeamReadingListPanel
          key={localLists[currentIndex].id}
          list={localLists[currentIndex]}
          hasTeam={hasTeam}
          onDeleted={() => {
            const next = localLists.filter((_, i) => i !== currentIndex);
            setLocalLists(next);
            setCurrentIndex(Math.max(0, currentIndex - 1));
          }}
        />
      ) : null}

      {localLists.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {localLists.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                'size-1.5 rounded-full transition-colors',
                i === currentIndex ? 'bg-primary' : 'bg-muted-foreground/30 hover:bg-muted-foreground/60',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
