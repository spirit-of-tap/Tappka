import { Eye } from 'lucide-react';
import type { EssayViewWithProfile } from '@/lib/essays/types';

interface SeenByCoachBannerProps {
  coachViewers: EssayViewWithProfile[];
}

export function SeenByCoachBanner({ coachViewers }: SeenByCoachBannerProps) {
  if (coachViewers.length === 0) return null;

  const names = coachViewers.map((v) => v.viewer?.name ?? 'Kouč').join(', ');

  return (
    <div className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-4 py-2 rounded-lg">
      <Eye className="size-4 shrink-0" />
      <span>Viděl/a: {names}</span>
    </div>
  );
}
