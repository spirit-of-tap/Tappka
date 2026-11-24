'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StorageAvatar } from '@/components/storage/storage-avatar';
import { formatMemberCount } from '@/components/komunita/team-map';
import { coachLine, type MapGroup } from '@/lib/komunita/team-map';
import { ROLE_LABELS, type ProfileWithTeam } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';

interface PanelProps {
  pictureUrls: Record<string, string | null>;
  dense: boolean;
}

const PANEL_CLASS =
  'rounded-2xl border border-hero-foreground/15 bg-hero-foreground/5 p-4';
const DENSE_PANEL_CLASS = 'lg:sticky lg:top-4 lg:self-start';
const LIST_SCROLL_CLASS = 'lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto';
// Fills the map's height instead of stretching it; the list scrolls inside.
const FIT_PANEL_CLASS = 'lg:absolute lg:inset-0 lg:flex lg:flex-col';
const FIT_LIST_CLASS = 'lg:min-h-0 lg:flex-1 lg:overflow-y-auto';

function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className={cn('size-3 shrink-0 rounded-full', !color && 'bg-hero-muted')}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

function MemberRow({
  profile,
  pictureUrl,
  trailing,
}: {
  profile: ProfileWithTeam;
  pictureUrl: string | null;
  trailing?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-1">
      <Link
        href={`/komunita/profil/${profile.id}`}
        className="focus-ring-hero flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 motion-safe:transition-colors hover:bg-hero-foreground/10"
      >
        <StorageAvatar storageKey={pictureUrl} name={profile.name} className="size-10" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-hero-foreground">{profile.name}</span>
          <span className="block text-xs text-hero-muted">{ROLE_LABELS[profile.role]}</span>
        </span>
      </Link>
      {trailing}
    </li>
  );
}

export function TeamPanel({
  group,
  pictureUrls,
  dense,
  onBackToResults,
}: PanelProps & { group: MapGroup; onBackToResults: (() => void) | null }) {
  const coaches = coachLine(group);

  return (
    <div className={cn(PANEL_CLASS, dense ? DENSE_PANEL_CLASS : FIT_PANEL_CLASS)}>
      {onBackToResults && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBackToResults}
          className="focus-ring-hero -ml-2 mb-2 text-hero-muted hover:bg-hero-foreground/10 hover:text-hero-foreground"
        >
          <ArrowLeft />
          Zpět na výsledky hledání
        </Button>
      )}
      <div className="space-y-1 pb-3">
        <div className="flex items-center gap-2">
          <ColorDot color={group.color} />
          <h2 className="font-heading text-xl font-bold text-hero-foreground">{group.name}</h2>
        </div>
        <p className="text-sm text-hero-muted">
          {formatMemberCount(group.members.length)}
          {coaches && ` · ${coaches}`}
        </p>
        {group.kind === 'team' && (
          <Link
            href={`/komunita/tymy/${group.id}`}
            className="focus-ring-hero inline-block rounded text-sm font-medium text-hero-foreground underline underline-offset-4"
          >
            Detail týmu →
          </Link>
        )}
      </div>
      <ul className={cn('space-y-0.5', dense ? LIST_SCROLL_CLASS : FIT_LIST_CLASS)}>
        {group.members.map((member) => (
          <MemberRow key={member.id} profile={member} pictureUrl={pictureUrls[member.id] ?? null} />
        ))}
      </ul>
    </div>
  );
}

export function SearchResultsPanel({
  people,
  groupIdOf,
  groupsById,
  pictureUrls,
  dense,
  onSelectGroup,
}: PanelProps & {
  people: ProfileWithTeam[];
  groupIdOf: Map<string, string>;
  groupsById: Map<string, MapGroup>;
  onSelectGroup: (groupId: string) => void;
}) {
  return (
    <div className={cn(PANEL_CLASS, dense ? DENSE_PANEL_CLASS : FIT_PANEL_CLASS)}>
      <div className="space-y-1 pb-3">
        <h2 className="font-heading text-xl font-bold text-hero-foreground">Výsledky hledání</h2>
        <p className="text-sm text-hero-muted">{formatMemberCount(people.length)}</p>
      </div>
      <ul className={cn('space-y-0.5', dense ? LIST_SCROLL_CLASS : FIT_LIST_CLASS)}>
        {people.map((person) => {
          const groupId = groupIdOf.get(person.id);
          const group = groupId ? groupsById.get(groupId) : undefined;
          return (
            <MemberRow
              key={person.id}
              profile={person}
              pictureUrl={pictureUrls[person.id] ?? null}
              trailing={
                group ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectGroup(group.id)}
                    className="focus-ring-hero max-w-[40%] shrink-0 gap-1.5 text-hero-muted hover:bg-hero-foreground/10 hover:text-hero-foreground"
                  >
                    <ColorDot color={group.color} />
                    <span className="truncate">{group.name}</span>
                  </Button>
                ) : person.team ? (
                  <span className="max-w-[40%] shrink-0 truncate px-2 text-xs text-hero-muted">
                    {person.team.name}
                  </span>
                ) : null
              }
            />
          );
        })}
      </ul>
    </div>
  );
}
