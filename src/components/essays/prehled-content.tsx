'use client';

import Link from 'next/link';
import { Plus, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MyEssayList } from './my-essay-list';
import { TeamBookPointsChart } from '@/components/teams/team-book-points-chart';
import { MetricProgress } from '@/components/metrics/metric-progress';
import { MobileFab, MobileFabSpacer } from '@/components/mobile-fab';
import { ActiveLoansCard } from '@/components/library/active-loans-card';
import { getMetric } from '@/lib/metrics/config';
import type { EssayWithDetails } from '@/lib/essays/types';
import type { BookLoanWithDetails } from '@/lib/library/types';

interface PrehledContentProps {
  stats: {
    approved_points: number;
    pending_points: number;
    essay_count: number;
    approved_points_this_semester: number;
  };
  myEssays: EssayWithDetails[];
  drafts: EssayWithDetails[];
  teamStats: {
    profile: { id: string; name: string; picture: string | null };
    approved_points: number;
    pending_points: number;
  }[];
  hasTeam: boolean;
  teamId?: string | null;
  votedEssayIds: Set<string>;
  loans?: BookLoanWithDetails[];
}

const KNIZNI_BODY_METRIC = getMetric('knizni-body');

export function PrehledContent({
  stats,
  myEssays,
  drafts,
  teamStats,
  hasTeam,
  teamId,
  votedEssayIds,
  loans = [],
}: PrehledContentProps) {
  return (
    <div className="space-y-8">
      {/* 1. Reading goal / semester progress */}
      <section aria-label="Pokrok ve čtení">
        <MetricProgress
          goals={[
            {
              current: stats.approved_points_this_semester,
              target: KNIZNI_BODY_METRIC.target ?? 0,
              label: 'tento semestr',
            },
            {
              current: stats.approved_points,
              target: KNIZNI_BODY_METRIC.totalForStudy ?? 0,
              label: 'za studium',
            },
          ]}
        />
      </section>

      {/* 2. Active Loan(s) banner / card if borrowed */}
      <ActiveLoansCard loans={loans} />

      {/* 3. My essays & drafts */}
      <section aria-label="Moje eseje" className="space-y-4">
        <div className="flex items-end justify-between gap-3 border-b pb-2">
          <div>
            <h2 className="font-heading text-lg font-semibold">Moje eseje</h2>
            <p className="text-xs text-muted-foreground">
              Rozepsané koncepty a odevzdané eseje
            </p>
          </div>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/cteni/eseje/nova">
              <Plus className="size-4 mr-1.5" />
              Napsat esej
            </Link>
          </Button>
        </div>

        {myEssays.length === 0 && drafts.length === 0 ? (
          <div className="space-y-3 rounded-xl border border-dashed px-6 py-12 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="font-medium">Ještě tu nic není</p>
              <p className="text-sm text-muted-foreground">
                První esej si můžeš rozepsat a dokončit kdykoliv později.
              </p>
            </div>
            <Button asChild>
              <Link href="/cteni/eseje/nova">Napsat esej</Link>
            </Button>
          </div>
        ) : (
          <MyEssayList essays={myEssays} drafts={drafts} votedEssayIds={votedEssayIds} />
        )}
      </section>

      {/* 4. Team BookPoints overview */}
      {hasTeam && (
        <section aria-label="Tým a BookPoints" className="space-y-4 pt-4 border-t">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Tým a BookPoints</h2>
              <p className="text-sm text-muted-foreground">
                Schválené a čekající knihy na cestu k cíli 120 bodů
              </p>
            </div>
            {teamId && (
              <Button asChild variant="ghost" size="sm" className="gap-1 text-xs shrink-0">
                <Link href={`/komunita/tymy/${teamId}?tab=statistiky`}>
                  Detail týmu
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
          <TeamBookPointsChart stats={teamStats} />
        </section>
      )}

      {/* Mobile Floating Action Button */}
      <MobileFab label="Napsat esej" href="/cteni/eseje/nova" />
      <MobileFabSpacer />
    </div>
  );
}
