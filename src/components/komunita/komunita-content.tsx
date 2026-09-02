'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X, Users, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TeamBadges } from '@/components/komunita/team-badges';
import { UserCard } from '@/components/komunita/user-card';
import type { ProfileWithTeam, TeamWithCount } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';

interface KomunitaContentProps {
  profiles: ProfileWithTeam[];
  pictureUrls: Record<string, string | null>;
  teams: TeamWithCount[];
  initialQuery?: string;
}

/** Diacritics-insensitive, lowercase normalization for matching Czech names. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function KomunitaContent({
  profiles,
  pictureUrls,
  teams,
  initialQuery = '',
}: KomunitaContentProps) {
  const [query, setQuery] = useState(initialQuery);
  const [showOldTeams, setShowOldTeams] = useState(false);

  // Keep ?search= in the URL without triggering a server navigation/refetch.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trimmed = query.trim();
    if (trimmed) {
      params.set('search', trimmed);
    } else {
      params.delete('search');
    }
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [query]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return profiles;
    return profiles.filter((p) => {
      return (
        normalize(p.name ?? '').includes(q) ||
        normalize(p.work_email).includes(q) ||
        (p.personal_email ? normalize(p.personal_email).includes(q) : false)
      );
    });
  }, [profiles, query]);

  const { activeProfiles, oldTeamProfiles } = useMemo(() => {
    const active: ProfileWithTeam[] = [];
    const oldTeams: ProfileWithTeam[] = [];

    for (const profile of filtered) {
      if (profile.team?.removed_at) {
        oldTeams.push(profile);
      } else {
        active.push(profile);
      }
    }

    return { activeProfiles: active, oldTeamProfiles: oldTeams };
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Hledat podle jména nebo emailu…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pl-12 pr-12 text-base rounded-xl shadow-sm"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 size-8 p-0"
            onClick={() => setQuery('')}
          >
            <X className="size-4" />
            <span className="sr-only">Vymazat hledání</span>
          </Button>
        )}
      </div>

      {/* Team Badges */}
      <TeamBadges teams={teams} />

      {/* Results Count */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="size-4" />
        <span>
          {filtered.length}{' '}
          {filtered.length === 1 ? 'člověk' : filtered.length < 5 ? 'lidé' : 'lidí'}
        </span>
      </div>

      {/* People Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Users className="size-12 mx-auto text-muted-foreground" />
          <h3 className="font-semibold text-lg">Nikoho jsme nenašli</h3>
          <p className="text-sm text-muted-foreground">Zkuste upravit vyhledávání</p>
          {query && (
            <Button variant="outline" size="sm" onClick={() => setQuery('')}>
              Vymazat hledání
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {activeProfiles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {activeProfiles.map((profile) => (
                <UserCard
                  key={profile.id}
                  profile={profile}
                  pictureUrl={pictureUrls[profile.id] ?? null}
                />
              ))}
            </div>
          )}

          {oldTeamProfiles.length > 0 && (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setShowOldTeams((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              >
                <ChevronDown
                  className={cn(
                    'size-3.5 transition-transform duration-200',
                    showOldTeams && 'rotate-180'
                  )}
                />
                Lidé ze starých týmů
                <span className="text-muted-foreground/70">({oldTeamProfiles.length})</span>
              </button>

              {showOldTeams && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {oldTeamProfiles.map((profile) => (
                    <UserCard
                      key={profile.id}
                      profile={profile}
                      pictureUrl={pictureUrls[profile.id] ?? null}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
