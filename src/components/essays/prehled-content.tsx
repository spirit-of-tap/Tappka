'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, FileText, Search, SearchX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { MyEssayList } from './my-essay-list';
import { CopyEssaysButton } from './copy-essays-button';
import { MetricProgress } from '@/components/metrics/metric-progress';
import { TeamPointsRanking } from '@/components/teams/team-points-ranking';
import { MobileFab, MobileFabSpacer } from '@/components/mobile-fab';
import { ActiveLoansCard } from '@/components/library/active-loans-card';
import { getMetric } from '@/lib/metrics/config';
import { filterMyEssays } from '@/lib/essays/my-essay-search';
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
  /** Team cohort year; drives which semester the progress strip shows. */
  onboardingYear?: number | null;
  votedEssayIds: Set<string>;
  /** Essays where a coach commented after the author's last comment. */
  awaitingReplyIds?: Set<string>;
  loans?: BookLoanWithDetails[];
  /** Team members' points; shown when the progress bar is expanded. Empty = no team. */
  teamStats?: {
    profile: { id: string; name: string; picture: string | null };
    approved_points: number;
    pending_points: number;
  }[];
  /** Highlights the viewer's row in the team ranking. */
  currentProfileId?: string;
}

const KNIZNI_BODY_METRIC = getMetric('knizni-body');

export function PrehledContent({
  stats,
  myEssays,
  onboardingYear,
  votedEssayIds,
  awaitingReplyIds,
  loans = [],
  teamStats = [],
  currentProfileId,
}: PrehledContentProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const filteredEssays = filterMyEssays(myEssays, searchQuery);

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };

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
          onboardingYear={onboardingYear}
          detailsLabel={teamStats.length > 0 ? 'Pořadí v týmu' : undefined}
          details={
            teamStats.length > 0 ? (
              <TeamPointsRanking
                stats={teamStats}
                goal={KNIZNI_BODY_METRIC.totalForStudy ?? 0}
                currentProfileId={currentProfileId}
              />
            ) : undefined
          }
        />
      </section>

      {/* 2. Borrowed books — full width, due dates are time-sensitive */}
      <ActiveLoansCard loans={loans} />

      {/* 3. My essays */}
      <section
        aria-labelledby="my-essays-heading"
        className="space-y-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="my-essays-heading" className="text-base font-semibold">
            Moje eseje{' '}
            {myEssays.length > 0 && (
              <span className="font-normal text-muted-foreground">{myEssays.length}</span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            {myEssays.length > 0 && <CopyEssaysButton essays={myEssays} />}
            {myEssays.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={isSearchOpen ? 'Zavřít hledání' : 'Hledat v mých esejích'}
                aria-expanded={isSearchOpen}
                aria-controls="my-essays-search"
                onClick={() => (isSearchOpen ? closeSearch() : setIsSearchOpen(true))}
                className={isSearchOpen ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}
              >
                <Search />
              </Button>
            )}
            {myEssays.length > 0 && (
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/cteni/eseje/nova">
                  <Plus className="size-4" />
                  Napsat esej
                </Link>
              </Button>
            )}
          </div>
        </div>

        {isSearchOpen && (
          <InputGroup id="my-essays-search">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeSearch();
              }}
              placeholder="Název, kniha nebo text eseje"
              aria-label="Hledat v mých esejích"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Zavřít hledání" onClick={closeSearch}>
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}

        {myEssays.length === 0 ? (
          <Empty className="gap-4 border border-dashed p-6 md:p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Zatím žádná esej</EmptyTitle>
              <EmptyDescription>
                Piš průběžně, ukládá se to samo. Esej uvidí ostatní, jakmile jí dáš název.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <Link href="/cteni/eseje/nova">Napsat esej</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : filteredEssays.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Nic nenalezeno</EmptyTitle>
              <EmptyDescription>Zkus jiné slovo z názvu, knihy nebo textu eseje.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <MyEssayList
                essays={filteredEssays}
                votedEssayIds={votedEssayIds}
                awaitingReplyIds={awaitingReplyIds}
              />
        )}
      </section>

      {/* Mobile Floating Action Button */}
      <MobileFab label="Napsat esej" href="/cteni/eseje/nova" />
      <MobileFabSpacer />
    </div>
  );
}
