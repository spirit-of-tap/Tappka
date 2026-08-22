'use client';

import Link from 'next/link';
import { BookMarked, Plus, FileText, User, Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MyEssayList } from './my-essay-list';
import { TeamBookPointsChart } from '@/components/teams/team-book-points-chart';
import { MetricProgress } from '@/components/metrics/metric-progress';
import { MobileFab, MobileFabSpacer } from '@/components/mobile-fab';
import { getMetric } from '@/lib/metrics/config';
import type { EssayWithDetails } from '@/lib/essays/types';
import { MyLoansList } from '@/components/library/my-loans-list';

interface PrehledTabsProps {
  defaultTab: string;
  stats: {
    approved_points: number;
    pending_points: number;
    essay_count: number;
    approved_points_this_semester: number;
  };
  myEssays: EssayWithDetails[];
  drafts: EssayWithDetails[];
  teamStats: { profile: { id: string; name: string; picture: string | null }; approved_points: number; pending_points: number }[];
  hasTeam: boolean;
  votedEssayIds: Set<string>;
}

const KNIZNI_BODY_METRIC = getMetric('knizni-body');

export function PrehledTabs({ defaultTab, stats, myEssays, drafts, teamStats, hasTeam, votedEssayIds }: PrehledTabsProps) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        {/* "Přehled", not "Moje" — the outer Čtení tab bar already has a Moje
            tab, and two stacked rows must not repeat a label. */}
        <TabsTrigger value="moje">
          <User />
          Přehled
        </TabsTrigger>
        <TabsTrigger value="tym">
          <Users />
          Tým
        </TabsTrigger>
        <TabsTrigger value="vypujcky">
          <BookMarked />
          Výpůjčky
        </TabsTrigger>
      </TabsList>

      {/* Moje tab */}
      <TabsContent value="moje" className="mt-6 space-y-6">
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

        <div className="flex items-end justify-between gap-3 border-b pb-2">
          <h2 className="font-heading text-lg font-semibold">Moje eseje</h2>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/cteni/eseje/nova">
              <Plus className="size-4 mr-1.5" />
              Psát
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

        {/* Lives inside the Moje tab so it disappears with the tab — writing
            is the only create action this surface offers. */}
        <MobileFab label="Napsat esej" href="/cteni/eseje/nova" />
        <MobileFabSpacer />
      </TabsContent>

      {/* Tým tab */}
      <TabsContent value="tym" className="mt-6">
        {!hasTeam ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Nejsi v žádném týmu.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">BookPoints — přehled týmu</h2>
              <p className="text-sm text-muted-foreground">Schválené a čekající knihy na cestu k cíli 120 bodů</p>
            </div>
            <TeamBookPointsChart stats={teamStats} />
          </div>
        )}
      </TabsContent>

      {/* Výpůjčky tab */}
      <TabsContent value="vypujcky" className="mt-6">
        <MyLoansList />
      </TabsContent>
    </Tabs>
  );
}
