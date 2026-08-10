'use client';

import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PersonalProgress } from './personal-progress';
import { MyEssayList } from './my-essay-list';
import { InfoCard } from './info-card';
import { TeamBookPointsChart } from '@/components/teams/team-book-points-chart';
import type { EssayWithDetails } from '@/lib/essays/types';
import { MyLoansList } from '@/components/library/my-loans-list';

interface PrehledTabsProps {
  defaultTab: string;
  stats: { approved_points: number; pending_points: number; essay_count: number };
  myEssays: EssayWithDetails[];
  drafts: EssayWithDetails[];
  teamStats: { profile: { id: string; name: string; picture: string | null }; approved_points: number; pending_points: number }[];
  hasTeam: boolean;
  votedEssayIds: Set<string>;
}

export function PrehledTabs({ defaultTab, stats, myEssays, drafts, teamStats, hasTeam, votedEssayIds }: PrehledTabsProps) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="moje">Moje</TabsTrigger>
        <TabsTrigger value="tym">Tým</TabsTrigger>
        <TabsTrigger value="vypujcky">Výpůjčky</TabsTrigger>
      </TabsList>

      {/* Moje tab */}
      <TabsContent value="moje" className="mt-6 space-y-6">
        <InfoCard />
        <PersonalProgress approved_points={stats.approved_points} pending_points={stats.pending_points} />

        <div className="flex items-end justify-between gap-3 border-b pb-2">
          <h2 className="font-heading text-lg font-semibold">Moje eseje</h2>
          <Button asChild size="sm">
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
      </TabsContent>

      {/* Tým tab */}
      <TabsContent value="tym" className="mt-6">
        {!hasTeam ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Nejsi zařazen/a do žádného týmu.</p>
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
