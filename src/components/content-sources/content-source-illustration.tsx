import { Podcast, Presentation, GraduationCap, Sparkles, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentSourceKind } from '@/lib/content-sources/types';

const KIND_ICON: Record<ContentSourceKind, LucideIcon> = {
  podcast: Podcast,
  conference: Presentation,
  program: GraduationCap,
  other: Sparkles,
};

const KIND_COLOR: Record<ContentSourceKind, string> = {
  podcast: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
  conference: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
  program: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  other: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
};

interface ContentSourceIllustrationProps {
  kind: ContentSourceKind;
  className?: string;
}

/**
 * Predefined icon tile standing in for a cover image — content sources have
 * no uploaded artwork, so every source of a given kind looks the same.
 *
 * Purely decorative (`aria-hidden`, no role/label of its own): every place
 * this renders already carries the kind as visible text right next to it
 * (a button label, a card title row, a picker's kind name) — giving the tile
 * its own `role="img"`/`aria-label` would double up that text in the
 * accessible name of any ancestor that derives its name from content, e.g.
 * a `<button>` wrapping both the icon and the label "Podcast" would compute
 * an accessible name of "Podcast Podcast" instead of "Podcast".
 */
export function ContentSourceIllustration({ kind, className }: ContentSourceIllustrationProps) {
  const Icon = KIND_ICON[kind];
  return (
    <div
      aria-hidden="true"
      className={cn('flex items-center justify-center rounded', KIND_COLOR[kind], className)}
    >
      <Icon className="size-1/2" />
    </div>
  );
}
