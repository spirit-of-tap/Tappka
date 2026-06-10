'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TeamReadingListCard } from './team-reading-list-card';
import type { TeamReadingList } from '@/lib/books/team-lists';

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
        setLocalLists((prev) => [{ ...data, team: null, books: [] }, ...prev]);
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Doporučené od týmů</h2>
        {hasTeam && !creating && (
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="size-3.5" />
            Přidat seznam
          </Button>
        )}
      </div>

      {creating && (
        <>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Název seznamu..."
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
        </>
      )}

      {localLists.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Zatím žádné seznamy — přidej první pro svůj tým
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {localLists.map((list) => (
            <TeamReadingListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </div>
  );
}
