import Link from 'next/link';
import { PenLine, DoorOpen, Search, Inbox, ScrollText, type LucideIcon } from 'lucide-react';

import { CTENI_SCROLLKY_HREF } from '@/lib/constants/cteni';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
  isCoach: boolean;
  unreadCount?: number;
}

interface QuickAction {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Tinted chip behind the icon; one hue per action so the row scans quickly. */
  chip: string;
  badge?: number;
}

const CHIP_AMBER = 'bg-chart-2/15 text-chart-2-strong';
const CHIP_TEAL = 'bg-chart-3/15 text-chart-3-strong';
const CHIP_VIOLET = 'bg-chart-5/15 text-chart-5';
const CHIP_MAGENTA = 'bg-chart-4/15 text-chart-4';

export function QuickActions({ isCoach, unreadCount = 0 }: QuickActionsProps) {
  const actions: QuickAction[] = [
    isCoach
      ? {
          href: '/cteni/eseje/ke-kontrole',
          label: 'Zkontrolovat eseje',
          icon: Inbox,
          chip: CHIP_AMBER,
          badge: unreadCount,
        }
      : { href: '/cteni/eseje/nova', label: 'Napsat esej', icon: PenLine, chip: CHIP_AMBER },
    { href: '/reservations', label: 'Rezervovat místnost', icon: DoorOpen, chip: CHIP_TEAL },
    { href: '/cteni/hledat', label: 'Hledat knihu', icon: Search, chip: CHIP_VIOLET },
    { href: CTENI_SCROLLKY_HREF, label: 'Scrollky', icon: ScrollText, chip: CHIP_MAGENTA },
  ];

  return (
    <nav aria-label="Rychlé akce" className="flex flex-wrap gap-2">
      {actions.map(({ href, label, icon: Icon, chip, badge }) => (
        <Link
          key={href}
          href={href}
          className="focus-ring inline-flex h-10 items-center gap-2 rounded-full border bg-card pr-4 pl-1.5 text-sm font-medium motion-safe:transition-colors hover:bg-accent"
        >
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', chip)}>
            <Icon className="size-3.5" aria-hidden />
          </span>
          {label}
          {badge ? (
            <span className="rounded-full bg-primary px-1.5 text-xs tabular-nums text-primary-foreground">
              {badge}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
