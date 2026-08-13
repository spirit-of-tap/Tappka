import { CheckCheck } from 'lucide-react';
import type { EssayCoachReadWithProfile } from '@/lib/essays/types';

interface ReadByCoachBannerProps {
  reads: EssayCoachReadWithProfile[];
}

export function ReadByCoachBanner({ reads }: ReadByCoachBannerProps) {
  if (reads.length === 0) return null;

  const names = reads.map((r) => r.coach?.name ?? 'Kouč:ka').join(', ');
  const latest = reads
    .map((r) => r.read_at)
    .sort((a, b) => b.localeCompare(a))[0];
  const date = new Date(latest).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex items-center gap-2 text-sm bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 px-4 py-2 rounded-lg font-medium">
      <CheckCheck className="size-4 shrink-0" />
      <span>Přečteno koučem:kou {names} · {date}</span>
    </div>
  );
}
