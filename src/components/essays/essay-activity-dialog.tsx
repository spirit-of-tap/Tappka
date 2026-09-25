'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, ThumbsUp, RefreshCw, AlertCircle } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/responsive-dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsTriggerCount,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { ProfileAvatar } from '@/components/profile-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/komunita/types';
import { formatRelativeTime } from '@/lib/essays/date-helpers';
import { cn } from '@/lib/utils';
import type { EssayActivityData, EssayEngagementProfile } from '@/lib/essays/types';

interface EssayActivityDialogProps {
  essayId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'views' | 'votes';
  initialViewCount?: number;
  initialVoteCount?: number;
  isAuthor?: boolean;
}

function ProfileRow({
  profile,
  profileId,
  timeText,
  icon,
  onNavigate,
}: {
  profile: EssayEngagementProfile | null;
  profileId: string;
  timeText: string;
  icon?: React.ReactNode;
  onNavigate?: () => void;
}) {
  const name = profile?.name ?? 'Uživatel:ka';
  const role = profile?.role;
  const isSpecialRole = role && role !== 'student';

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40 rounded-lg px-2 -mx-2">
      <Link
        href={`/komunita/profil/${profileId}`}
        onClick={onNavigate}
        className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-85 transition-opacity"
      >
        <ProfileAvatar
          picture={profile?.picture}
          name={name}
          size={36}
          className="ring-1 ring-border/50 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isSpecialRole ? (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-block',
                  ROLE_COLORS[role],
                )}
              >
                {ROLE_LABELS[role]}
              </span>
            ) : profile?.team ? (
              <span className="text-xs text-muted-foreground truncate">
                {profile.team.name}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Student:ka</span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground/70 select-none">
        {icon}
        <span>{timeText}</span>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3 py-2" aria-hidden>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-2 px-1">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-3 w-14" />
        </div>
      ))}
    </div>
  );
}

export function EssayActivityDialog({
  essayId,
  open,
  onOpenChange,
  initialTab = 'views',
  initialViewCount = 0,
  initialVoteCount = 0,
  isAuthor: initialIsAuthor = false,
}: EssayActivityDialogProps) {
  const [activeTab, setActiveTab] = useState<'views' | 'votes'>(initialTab);
  const [data, setData] = useState<EssayActivityData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const fetchData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const res = await fetch(`/api/essays/${essayId}/activity`);
      if (!res.ok) throw new Error('Nepodařilo se načíst data');
      const json: EssayActivityData = await res.json();
      setData(json);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void fetchData();
  }, [open, essayId]);

  const isAuthor = data?.isAuthor ?? initialIsAuthor;
  const viewCount = data ? data.views.length : initialViewCount;
  const voteCount = data ? data.votes.length : initialVoteCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="font-heading text-lg">Aktivita u eseje</DialogTitle>
          <DialogDescription className="text-xs">
            Přehled lidí, kteří si esej přečetli nebo ji podpořili.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 sm:p-5">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'views' | 'votes')}
          >
            <TabsList variant="segmented" className="w-full">
              <TabsTrigger value="views" className="flex-1 gap-1.5">
                <Eye className="size-3.5" />
                <span>Zobrazení</span>
                <TabsTriggerCount count={viewCount} />
              </TabsTrigger>
              <TabsTrigger value="votes" className="flex-1 gap-1.5">
                <ThumbsUp className="size-3.5" />
                <span>To se mi líbí</span>
                <TabsTriggerCount count={voteCount} />
              </TabsTrigger>
            </TabsList>

            {/* Tab: Views */}
            <TabsContent value="views" className="mt-3 outline-none">
              {isLoading && <ListSkeleton />}

              {!isLoading && hasError && (
                <div className="py-8 text-center space-y-3">
                  <AlertCircle className="mx-auto size-6 text-destructive" />
                  <p className="text-sm text-muted-foreground">
                    Nepodařilo se načíst zobrazení.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchData()}
                    className="gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    Zkusit znovu
                  </Button>
                </div>
              )}

              {!isLoading && !hasError && (
                <>
                  {!isAuthor ? (
                    <Empty className="py-8">
                      <EmptyMedia variant="icon">
                        <Eye className="size-5 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>Soukromý přehled</EmptyTitle>
                        <EmptyDescription>
                          Seznam čtenářů a čtenářek vidí pouze autor:ka eseje.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : data?.views.length === 0 ? (
                    <Empty className="py-8">
                      <EmptyMedia variant="icon">
                        <Eye className="size-5 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>Zatím žádná zobrazení</EmptyTitle>
                        <EmptyDescription>
                          Až si někdo esej přečte, uvidíš to zde.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="max-h-[50vh] sm:max-h-[360px] overflow-y-auto divide-y divide-border/40 pr-1">
                      {data?.views.map((item) => (
                        <ProfileRow
                          key={item.viewer_profile_id}
                          profile={item.viewer}
                          profileId={item.viewer_profile_id}
                          timeText={formatRelativeTime(item.last_viewed_at)}
                          onNavigate={() => onOpenChange(false)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Tab: Votes / Boosts */}
            <TabsContent value="votes" className="mt-3 outline-none">
              {isLoading && <ListSkeleton />}

              {!isLoading && hasError && (
                <div className="py-8 text-center space-y-3">
                  <AlertCircle className="mx-auto size-6 text-destructive" />
                  <p className="text-sm text-muted-foreground">
                    Nepodařilo se načíst reakce.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchData()}
                    className="gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    Zkusit znovu
                  </Button>
                </div>
              )}

              {!isLoading && !hasError && (
                <>
                  {data?.votes.length === 0 ? (
                    <Empty className="py-8">
                      <EmptyMedia variant="icon">
                        <ThumbsUp className="size-5 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyHeader>
                        <EmptyTitle>Zatím žádné to se mi líbí</EmptyTitle>
                        <EmptyDescription>
                          Až esej někoho inspiruje nebo potěší, uvidíš to zde.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="max-h-[50vh] sm:max-h-[360px] overflow-y-auto divide-y divide-border/40 pr-1">
                      {data?.votes.map((item) => (
                        <ProfileRow
                          key={item.voter_profile_id}
                          profile={item.voter}
                          profileId={item.voter_profile_id}
                          timeText={formatRelativeTime(item.created_at)}
                          icon={<ThumbsUp className="size-3 text-primary shrink-0" />}
                          onNavigate={() => onOpenChange(false)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
