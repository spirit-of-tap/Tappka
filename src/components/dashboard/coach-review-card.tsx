import Link from 'next/link';
import { ArrowRight, CheckCheck, Users } from 'lucide-react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { DASHBOARD_SECTION, DashboardCardTitle } from '@/components/dashboard/dashboard-card-title';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { ProfileAvatar } from '@/components/profile-avatar';
import { getEssaySourceDisplay } from '@/lib/essays/source-display';
import type { CoachReviewEssay } from '@/lib/essays/types';

interface CoachReviewCardProps {
  essays: CoachReviewEssay[];
  hasTeam: boolean;
}

export function CoachReviewCard({ essays, hasTeam }: CoachReviewCardProps) {
  const preview = essays.slice(0, 3);

  return (
    <Card className={DASHBOARD_SECTION}>
      <CardHeader>
        <DashboardCardTitle className="flex items-center gap-2">
          Eseje ke kontrole
          {hasTeam && essays.length > 0 && (
            <span className="rounded-full bg-primary px-2 text-xs leading-5 text-primary-foreground">
              {essays.length}
            </span>
          )}
        </DashboardCardTitle>
        {hasTeam && essays.length > 0 && (
          <CardDescription>
            {`${essays.length} ${essays.length === 1 ? 'nepřečtená esej' : essays.length < 5 ? 'nepřečtené eseje' : 'nepřečtených esejí'} od tvého týmu`}
          </CardDescription>
        )}
        <CardAction>
          <Link
            href="/cteni/eseje/ke-kontrole"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            Otevřít
            <ArrowRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {preview.length === 0 ? (
          hasTeam ? (
            <DashboardEmptyState
              icon={CheckCheck}
              tone="bg-success/10 text-success-strong"
              title="Máš všechno přečteno"
              description="Žádná esej tvého týmu nečeká na tvou kontrolu. Nové se tu objeví, jakmile je někdo odevzdá."
            />
          ) : (
            <DashboardEmptyState
              icon={Users}
              title="Zatím bez týmu"
              description="Eseje tvého týmu se tu zobrazí, jakmile ti bude tým přiřazen."
            />
          )
        ) : (
          <ul className="divide-y">
            {preview.map((essay) => {
              const sourceTitle = getEssaySourceDisplay(essay).title;
              return (
              <li key={essay.id}>
                <Link href={`/cteni/eseje/${essay.id}`} className="group flex items-center gap-3 py-2.5">
                  <ProfileAvatar
                    picture={essay.author?.picture ?? null}
                    name={essay.author?.name ?? '?'}
                    size={32}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium group-hover:underline underline-offset-4 line-clamp-1">
                      {essay.title}
                    </span>
                    <span className="block text-xs text-muted-foreground line-clamp-1">
                      {essay.author?.name ?? 'Neznámý:á autor:ka'}
                      {sourceTitle && ` · ${sourceTitle}`}
                      {' · '}
                      {new Date(essay.created_at).toLocaleDateString('cs-CZ', {
                        day: 'numeric',
                        month: 'numeric',
                      })}
                    </span>
                  </span>
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
