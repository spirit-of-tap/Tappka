'use client';

import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PersonalProgress } from './personal-progress';
import { MyEssayList } from './my-essay-list';
import { TeamBookPointsChart } from '@/components/teams/team-book-points-chart';
import type { EssayWithDetails } from '@/lib/essays/types';

interface PrehledTabsProps {
  defaultTab: string;
  stats: { approved_points: number; pending_points: number; essay_count: number };
  myEssays: EssayWithDetails[];
  teamStats: { profile: { id: string; name: string; picture: string | null }; approved_points: number; pending_points: number }[];
  hasTeam: boolean;
  votedEssayIds: Set<string>;
}

export function PrehledTabs({ defaultTab, stats, myEssays, teamStats, hasTeam, votedEssayIds }: PrehledTabsProps) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="moje">Moje</TabsTrigger>
        <TabsTrigger value="tym">Tým</TabsTrigger>
      </TabsList>

      {/* Moje tab */}
      <TabsContent value="moje" className="mt-6 space-y-6">
        <PersonalProgress approved_points={stats.approved_points} pending_points={stats.pending_points} />

        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Moje eseje</h2>
          <Button asChild size="sm">
            <Link href="/eseje/nova">
              <Plus className="size-4 mr-1.5" />
              Psát
            </Link>
          </Button>
        </div>

        {myEssays.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <FileText className="size-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Zatím žádné eseje. Napiš svou první!</p>
            <Button asChild>
              <Link href="/eseje/nova">Napsat esej</Link>
            </Button>
          </div>
        ) : (
          <MyEssayList essays={myEssays} votedEssayIds={votedEssayIds} />
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
    </Tabs>
  );
}
