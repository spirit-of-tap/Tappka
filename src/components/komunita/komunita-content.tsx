'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Users, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { TeamMap } from '@/components/komunita/team-map';
import { SearchResultsPanel, TeamPanel } from '@/components/komunita/team-panel';
import { UserCard } from '@/components/komunita/user-card';
import { isAlumnus } from '@/lib/komunita/alumni';
import {
  DENSE_MAP_GROUP_COUNT,
  buildMapGroups,
  defaultSelectedGroupId,
  groupIdByProfile,
  searchMap,
} from '@/lib/komunita/team-map';
import type { ProfileWithTeam } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';

const MOBILE_PANEL_QUERY = '(max-width: 1023px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

interface KomunitaContentProps {
  profiles: ProfileWithTeam[];
  pictureUrls: Record<string, string | null>;
  viewerTeamId?: string | null;
  initialQuery?: string;
}

export function KomunitaContent({
  profiles,
  pictureUrls,
  viewerTeamId = null,
  initialQuery = '',
}: KomunitaContentProps) {
  const [query, setQuery] = useState(initialQuery);
  const [showAlumni, setShowAlumni] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

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

  const isSearching = query.trim() !== '';
  const groups = useMemo(() => buildMapGroups(profiles, viewerTeamId), [profiles, viewerTeamId]);
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const groupIdOf = useMemo(() => groupIdByProfile(groups), [groups]);
  const search = useMemo(() => searchMap(profiles, groups, query), [profiles, groups, query]);

  const alumniProfiles = useMemo(
    () => (isSearching ? [] : profiles.filter(isAlumnus)),
    [profiles, isSearching]
  );

  const selectedGroup =
    (selectedId ? groupsById.get(selectedId) : undefined) ??
    groupsById.get(defaultSelectedGroupId(groups, viewerTeamId) ?? '');
  const dense = groups.length > DENSE_MAP_GROUP_COUNT;
  const hasNoResults = isSearching && search.people.length === 0 && search.highlightedGroupIds.size === 0;

  function updateQuery(value: string) {
    setQuery(value);
    setShowResults(true);
  }

  function selectGroup(groupId: string) {
    setSelectedId(groupId);
    setShowResults(false);
    if (window.matchMedia?.(MOBILE_PANEL_QUERY).matches) {
      const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
      panelRef.current?.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-primary" />
        <Input
          type="search"
          placeholder="Hledat podle jména nebo emailu…"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          className="h-14 rounded-2xl border-border/60 bg-card pl-12 pr-12 text-base shadow-sm focus-visible:border-primary"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 size-8 p-0"
            onClick={() => updateQuery('')}
          >
            <X className="size-4" />
            <span className="sr-only">Vymazat hledání</span>
          </Button>
        )}
      </div>

      {hasNoResults ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>Nikoho jsme nenašli</EmptyTitle>
            <EmptyDescription>Zkus upravit vyhledávání</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => updateQuery('')}>
              Vymazat hledání
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        groups.length > 0 && (
          <section
            aria-label="Mapa týmů"
            className="grid gap-4 rounded-3xl bg-hero p-4 text-hero-foreground sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]"
          >
            <TeamMap
              groups={groups}
              selectedId={selectedGroup?.id ?? null}
              highlightedIds={isSearching ? search.highlightedGroupIds : null}
              pictureUrls={pictureUrls}
              onSelect={selectGroup}
            />
            <div ref={panelRef} className={cn('scroll-mt-4', !dense && 'lg:relative lg:min-h-96')}>
              {isSearching && showResults ? (
                <SearchResultsPanel
                  people={search.people}
                  groupIdOf={groupIdOf}
                  groupsById={groupsById}
                  pictureUrls={pictureUrls}
                  dense={dense}
                  onSelectGroup={selectGroup}
                />
              ) : (
                selectedGroup && (
                  <TeamPanel
                    group={selectedGroup}
                    pictureUrls={pictureUrls}
                    dense={dense}
                    onBackToResults={isSearching ? () => setShowResults(true) : null}
                  />
                )
              )}
            </div>
          </section>
        )
      )}

      {isSearching && groups.length === 0 && search.people.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {search.people.map((profile) => (
            <UserCard key={profile.id} profile={profile} pictureUrl={pictureUrls[profile.id] ?? null} />
          ))}
        </div>
      )}

      {alumniProfiles.length > 0 && (
        <div className="space-y-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAlumni((v) => !v)}
            aria-expanded={showAlumni}
            aria-controls="komunita-alumni"
            className="h-auto gap-1.5 px-0 text-xs font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                'size-3.5 motion-safe:transition-transform motion-safe:duration-200',
                showAlumni && 'rotate-180'
              )}
            />
            Už nestudující
            <span className="text-muted-foreground/70">({alumniProfiles.length})</span>
          </Button>

          {showAlumni && (
            <div
              id="komunita-alumni"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {alumniProfiles.map((profile) => (
                <UserCard key={profile.id} profile={profile} pictureUrl={pictureUrls[profile.id] ?? null} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
