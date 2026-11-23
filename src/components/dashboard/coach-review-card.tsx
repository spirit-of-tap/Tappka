import Link from 'next/link';
import { ArrowRight, CheckCheck, Users } from 'lucide-react';

import { ProfileAvatar } from '@/components/profile-avatar';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import type { CoachReviewEssay } from '@/lib/essays/types';

interface CoachReviewCardProps {
  essays: CoachReviewEssay[];
  hasTeam: boolean;
}

const PREVIEW_COUNT = 3;

function essaysLabel(n: number): string {
  if (n === 1) return 'nepřečtená esej od tvého týmu';
  return n < 5 ? 'nepřečtené eseje od tvého týmu' : 'nepřečtených esejí od tvého týmu';
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
          : 'flex h-full flex-col gap-3 rounded-2xl bg-primary p-5 text-primary-foreground md:p-6'
      }
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-medium uppercase tracking-wider opacity-80">Eseje ke kontrole</h2>
          {hasTeam && essays.length > 0 && (
            <p className="text-sm opacity-90">{essaysLabel(essays.length)}</p>
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
          <Users className="size-6 shrink-0 opacity-80" aria-hidden />
          <p className="text-sm">Eseje tvého týmu se tu zobrazí, jakmile ti bude tým přiřazen.</p>
        </div>
      ) : done ? (
        <div className="flex flex-1 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success/15">
            <CheckCheck className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-heading font-bold">Máš všechno přečteno</p>
            <p className="text-sm text-foreground/70">Nové eseje se tu objeví, jakmile je někdo odevzdá.</p>
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
                  className="focus-ring group flex items-center gap-3 rounded-xl bg-primary-foreground/10 px-3 py-2 transition-colors hover:bg-primary-foreground/18"
                >
                  <ProfileAvatar picture={essay.author?.picture ?? null} name={essay.author?.name ?? '?'} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium group-hover:underline underline-offset-4">
                      {essay.title}
                    </span>
                    <span className="block truncate text-xs opacity-80">
                      {essay.author?.name ?? 'Neznámý:á autor:ka'}
                      {sourceTitle && ` · ${sourceTitle}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs opacity-80">
                    {new Date(essay.created_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/cteni/eseje/ke-kontrole"
        className="focus-ring mt-auto inline-flex items-center gap-1 self-start rounded-sm text-sm font-medium hover:underline underline-offset-4"
      >
        {done ? 'Přehled esejí' : 'Otevřít vše'}
        <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}
