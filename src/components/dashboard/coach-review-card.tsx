import Link from 'next/link';
import { ArrowRight, CheckCheck, Users } from 'lucide-react';

import { ProfileAvatar } from '@/components/profile-avatar';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import type { CoachReviewEssay } from '@/lib/essays/types';
import { cn } from '@/lib/utils';
import { pluralizeCz } from '@/lib/utils/pluralize-cz';

interface CoachReviewCardProps {
  essays: CoachReviewEssay[];
  hasTeam: boolean;
}

const PREVIEW_COUNT = 3;
const TIME_ZONE = 'Europe/Prague';

function essaysLabel(n: number): string {
  return pluralizeCz(n, [
    'nepřečtená esej od tvého týmu',
    'nepřečtené eseje od tvého týmu',
    'nepřečtených esejí od tvého týmu',
  ]);
}

/** Solid TAP-red card: the one thing a coach should act on today. */
export function CoachReviewCard({ essays, hasTeam }: CoachReviewCardProps) {
  const preview = essays.slice(0, PREVIEW_COUNT);
  const done = hasTeam && essays.length === 0;

  return (
    <section
      className={
        done
          ? 'flex h-full flex-col gap-3 rounded-2xl bg-success/12 p-5 text-success-strong md:p-6'
          : 'flex h-full flex-col gap-3 rounded-2xl bg-spotlight p-5 text-spotlight-foreground md:p-6'
      }
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-medium uppercase tracking-wider">Eseje ke kontrole</h2>
          {hasTeam && essays.length > 0 && (
            <p className="text-sm">{essaysLabel(essays.length)}</p>
          )}
        </div>
        {hasTeam && essays.length > 0 && (
          <span className="ml-auto font-heading text-4xl font-extrabold leading-none tabular-nums">
            {essays.length}
          </span>
        )}
      </div>

      {!hasTeam ? (
        <div className="flex flex-1 items-center gap-3">
          <Users className="size-6 shrink-0 text-spotlight-muted" aria-hidden />
          <p className="text-sm">Eseje tvého týmu se tu zobrazí, jakmile ti bude tým přiřazen.</p>
        </div>
      ) : done ? (
        <div className="flex flex-1 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/15">
            <CheckCheck className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-heading font-bold">Máš všechno přečteno</p>
            <p className="text-sm">Nové eseje se tu objeví, jakmile je někdo odevzdá.</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {preview.map((essay) => {
            const sourceTitle = getEssaySourceDisplay(essay).title;
            return (
              <li key={essay.id}>
                <Link
                  href={`/cteni/eseje/${essay.id}`}
                  className="focus-ring-spotlight group flex items-center gap-3 rounded-xl bg-spotlight-foreground/10 px-3 py-2 motion-safe:transition-[background-color,transform] duration-200 hover:bg-spotlight-foreground/15 motion-safe:hover:translate-x-1"
                >
                  <ProfileAvatar picture={essay.author?.picture ?? null} name={essay.author?.name ?? '?'} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium group-hover:underline underline-offset-4">
                      {essay.title}
                    </span>
                    <span className="block truncate text-xs text-spotlight-muted">
                      {essay.author?.name ?? 'Neznámá osoba'}
                      {sourceTitle && ` · ${sourceTitle}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-spotlight-muted">
                    {new Date(essay.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: TIME_ZONE })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/cteni/eseje/ke-kontrole"
        className={cn(
          done ? 'focus-ring' : 'focus-ring-spotlight',
          'mt-auto inline-flex items-center gap-1 self-start rounded-sm text-sm font-medium hover:underline underline-offset-4',
        )}
      >
        {done ? 'Přehled esejí' : 'Otevřít vše'}
        <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}
