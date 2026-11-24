'use client';

import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { StorageAvatar } from '@/components/storage/storage-avatar';
import {
  RING_AVATAR_SIZE,
  bubbleDiameter,
  ringLayout,
  type MapGroup,
} from '@/lib/komunita/team-map';
import type { ProfileWithTeam } from '@/lib/komunita/types';
import { cn } from '@/lib/utils';
import { pluralizeCz } from '@/lib/utils/pluralize-cz';

const TEAM_COLOR = 'var(--team-color, var(--color-hero-muted))';
const BUBBLE_TINT_PERCENT = 16;
const GLOW_BLUR_PX = 28;
const GLOW_SPREAD_PX = -4;
const FULL_TURN_DEG = 360;
const START_ANGLE_DEG = -90;

interface TeamMapProps {
  groups: MapGroup[];
  selectedId: string | null;
  highlightedIds: ReadonlySet<string> | null;
  pictureUrls: Record<string, string | null>;
  onSelect: (groupId: string) => void;
}

export function formatMemberCount(count: number): string {
  return `${count} ${pluralizeCz(count, ['člověk', 'lidé', 'lidí'])}`;
}

function ringPosition(index: number, slots: number, diameter: number): CSSProperties {
  const angle = ((START_ANGLE_DEG + (FULL_TURN_DEG * index) / slots) * Math.PI) / 180;
  const radiusPercent = 50 - (RING_AVATAR_SIZE / diameter) * 50;
  return {
    left: `${50 + radiusPercent * Math.cos(angle)}%`,
    top: `${50 + radiusPercent * Math.sin(angle)}%`,
  };
}

function bubbleStyle(group: MapGroup, diameter: number, selected: boolean): CSSProperties {
  return {
    '--bubble-d': `${diameter}px`,
    '--team-color': group.color ?? undefined,
    borderColor: TEAM_COLOR,
    backgroundColor: `color-mix(in oklab, ${TEAM_COLOR} ${BUBBLE_TINT_PERCENT}%, transparent)`,
    boxShadow: selected ? `0 0 ${GLOW_BLUR_PX}px ${GLOW_SPREAD_PX}px ${TEAM_COLOR}` : undefined,
  } as CSSProperties;
}

function TeamBubble({
  group,
  selected,
  dimmed,
  pictureUrls,
  onSelect,
}: {
  group: MapGroup;
  selected: boolean;
  dimmed: boolean;
  pictureUrls: Record<string, string | null>;
  onSelect: (groupId: string) => void;
}) {
  const count = group.members.length;
  const diameter = bubbleDiameter(count);
  const { shown, overflow } = ringLayout(count, diameter);
  const slots = shown + (overflow > 0 ? 1 : 0);
  const ringMembers: ProfileWithTeam[] = group.members.slice(0, shown);
  const label = group.kind === 'team' ? `Tým ${group.name}` : group.name;

  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={selected}
      aria-label={`${label}, ${formatMemberCount(count)}`}
      onClick={() => onSelect(group.id)}
      style={bubbleStyle(group, diameter, selected)}
      className={cn(
        'focus-ring-hero relative size-[calc(var(--bubble-d)*var(--bubble-scale))] shrink-0 rounded-full border-2 p-0 text-hero-foreground hover:text-hero-foreground',
        'motion-safe:transition-[opacity,box-shadow,border-width] motion-safe:duration-200',
        selected && 'border-4',
        dimmed && 'opacity-35'
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0">
        {ringMembers.map((member, i) => (
          <span
            key={member.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-hero"
            style={ringPosition(i, slots, diameter)}
          >
            <StorageAvatar
              storageKey={pictureUrls[member.id] ?? null}
              name={member.name}
              className="size-[calc(var(--bubble-scale)*2rem)] [&_[data-slot=avatar-fallback]]:text-[0.6rem] sm:[&_[data-slot=avatar-fallback]]:text-xs"
            />
          </span>
        ))}
        {overflow > 0 && (
          <span
            className="absolute flex size-[calc(var(--bubble-scale)*2rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-hero-foreground text-[0.6rem] font-semibold text-hero ring-2 ring-hero sm:text-xs"
            style={ringPosition(shown, slots, diameter)}
          >
            +{overflow}
          </span>
        )}
      </span>

      <span className="flex w-[76%] flex-col items-center gap-0.5 whitespace-normal text-center">
        <span className="line-clamp-3 break-words text-balance font-heading text-[0.7rem] font-semibold leading-tight text-hero-foreground sm:text-sm">
          {group.name}
        </span>
        <span className="whitespace-nowrap text-[0.65rem] text-hero-muted sm:text-xs">
          {formatMemberCount(count)}
        </span>
      </span>
    </Button>
  );
}

export function TeamMap({ groups, selectedId, highlightedIds, pictureUrls, onSelect }: TeamMapProps) {
  return (
    <ul
      aria-label="Mapa týmů"
      className="flex flex-wrap content-start justify-center gap-2 [--bubble-scale:0.66] sm:gap-4 sm:[--bubble-scale:1]"
    >
      {groups.map((group) => (
        <li key={group.id} className="flex">
          <TeamBubble
            group={group}
            selected={group.id === selectedId}
            dimmed={highlightedIds !== null && !highlightedIds.has(group.id)}
            pictureUrls={pictureUrls}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
