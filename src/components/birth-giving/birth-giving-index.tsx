"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronDown, History, Plus, Search, Sparkles, UserCheck, Crown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { MetricProgress } from "@/components/metrics/metric-progress";
import { HelpDialog } from "@/components/help-dialog";
import { MobileFab, MobileFabSpacer } from "@/components/mobile-fab";
import { InfoCard } from "./info-card";
import { BirthGivingEventCard } from "./event-card";
import { BirthGivingEventForm } from "./event-form";
import { normalizeBirthGivingSearchQuery } from "@/lib/birth-giving/search";
import { getCurrentSemesterRange } from "@/lib/metrics/periods";
import { getMetric } from "@/lib/metrics/config";
import { getEventTimeState } from "@/lib/birth-giving/time";
import { pluralizeCz } from "@/lib/utils/pluralize-cz";
import { cn } from "@/lib/utils";
import type {
  BirthGivingEventIndexItem,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

const BIRTH_GIVING_METRIC = getMetric("birth-giving");
const SEARCH_PLACEHOLDER = "Hledat událost nebo zákazníka…";

interface BirthGivingIndexProps {
  events: BirthGivingEventIndexItem[];
  profileId: string;
  now: string;
  organizerProfiles: BirthGivingProfileSummary[];
}

type FilterMode = "all" | "participant" | "organizer";

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function BirthGivingIndex({
  events,
  profileId,
  now,
  organizerProfiles,
}: BirthGivingIndexProps) {
  const router = useRouter();
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const nowDate = useMemo(() => new Date(now), [now]);

  // Calculate user's participation metrics (published, active team participations)
  const { semesterCount, studyCount } = useMemo(() => {
    const { start, end } = getCurrentSemesterRange(nowDate);
    let semester = 0;
    let total = 0;

    for (const event of events) {
      if (event.status !== "published" || event.removed_at !== null) continue;
      const isParticipant = event.participant_profile_ids?.includes(profileId);
      if (!isParticipant) continue;

      total += 1;
      const eventStart = new Date(event.starts_at);
      if (eventStart >= start && eventStart < end) {
        semester += 1;
      }
    }

    return { semesterCount: semester, studyCount: total };
  }, [events, profileId, nowDate]);

  // Categorized counts for filter badges: Všechny, Zúčastnil:a jsem se, Pořádal:a jsem
  const filterCounts = useMemo(() => {
    let participant = 0;
    let organizer = 0;

    for (const event of events) {
      const isParticipant = event.participant_profile_ids?.includes(profileId);
      const isOrganizer = event.organizer_profile_ids?.includes(profileId);
      if (isParticipant) participant += 1;
      if (isOrganizer) organizer += 1;
    }

    return { all: events.length, participant, organizer };
  }, [events, profileId]);

  const searching = query.trim().length > 0;

  // Filter and sort events: today/active events pinned first, then upcoming, then past
  const displayedEvents = useMemo(() => {
    let baseList = events;
    if (filterMode === "participant") {
      baseList = events.filter((event) => event.participant_profile_ids?.includes(profileId));
    } else if (filterMode === "organizer") {
      baseList = events.filter((event) => event.organizer_profile_ids?.includes(profileId));
    }

    const needle = normalizeBirthGivingSearchQuery(query);
    if (needle) {
      baseList = baseList.filter((event) => {
        const haystack = normalizeBirthGivingSearchQuery(`${event.name} ${event.customer}`);
        return haystack.includes(needle);
      });
    }

    // Sort: Pinned today/active events first, then upcoming (asc), then past (desc)
    return [...baseList].sort((a, b) => {
      const aStartsAt = new Date(a.starts_at);
      const bStartsAt = new Date(b.starts_at);
      const aTimeState = getEventTimeState(aStartsAt, a.duration, nowDate);
      const bTimeState = getEventTimeState(bStartsAt, b.duration, nowDate);
      const aIsToday = aTimeState === "active" || isSameDay(aStartsAt, nowDate);
      const bIsToday = bTimeState === "active" || isSameDay(bStartsAt, nowDate);

      // 1. Pinned today/active events first
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;

      // 2. Upcoming events (ascending by date)
      const aIsUpcoming = aTimeState === "upcoming";
      const bIsUpcoming = bTimeState === "upcoming";
      if (aIsUpcoming && bIsUpcoming) {
        return aStartsAt.getTime() - bStartsAt.getTime();
      }
      if (aIsUpcoming && !bIsUpcoming) return -1;
      if (!aIsUpcoming && bIsUpcoming) return 1;

      // 3. Past events (descending by date)
      return bStartsAt.getTime() - aStartsAt.getTime();
    });
  }, [filterMode, events, profileId, nowDate, query]);

  function renderList(items: BirthGivingEventIndexItem[]) {
    if (items.length === 0) {
      if (searching) {
        return (
          <Empty className="border-dashed">
            <EmptyMedia variant="icon">
              <Search className="size-5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-sm">Nic jsme nenašli</EmptyTitle>
              <EmptyDescription className="text-xs">
                Pro „{query.trim()}“ nejsou v tomto filtru žádné výsledky. Zkus upravit hledání.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                Zrušit hledání
              </Button>
            </EmptyContent>
          </Empty>
        );
      }

      if (filterMode === "participant") {
        return (
          <Empty className="border-dashed">
            <EmptyMedia variant="icon">
              <UserCheck className="size-5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-sm">Zatím žádné tvé účasti</EmptyTitle>
              <EmptyDescription className="text-xs">
                Události, kterých se účastníš v týmu, se zobrazí tady.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => setFilterMode("all")}>
                Zobrazit všechny události
              </Button>
            </EmptyContent>
          </Empty>
        );
      }

      if (filterMode === "organizer") {
        return (
          <Empty className="border-dashed">
            <EmptyMedia variant="icon">
              <Crown className="size-5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-sm">Zatím žádné pořádané události</EmptyTitle>
              <EmptyDescription className="text-xs">
                Události, které organizuješ nebo jsi pořádal:a, se zobrazí tady.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => setFilterMode("all")}>
                Zobrazit všechny události
              </Button>
            </EmptyContent>
          </Empty>
        );
      }

      return (
        <Empty className="border-dashed">
          <EmptyMedia variant="icon">
            <CalendarDays className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">Žádné události</EmptyTitle>
            <EmptyDescription className="text-xs">
              Zatím nejsou naplánované ani zapsané žádné Birth Giving události.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Vytvořit událost
            </Button>
          </EmptyContent>
        </Empty>
      );
    }

    return (
      <div className="space-y-2.5">
        {items.map((event) => (
          <BirthGivingEventCard key={event.id} event={event} now={now} profileId={profileId} />
        ))}
      </div>
    );
  }

  const hasAny = events.length > 0;

  const filterBadges: { id: FilterMode; label: string; count: number }[] = [
    { id: "all", label: "Všechny", count: filterCounts.all },
    { id: "participant", label: "Zúčastnil:a jsem se", count: filterCounts.participant },
    { id: "organizer", label: "Pořádal:a jsem", count: filterCounts.organizer },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Birth Giving"
        description="Přehled hackathonů, týmových řešení a odevzdaných výstupů"
        count={{
          value: events.length,
          label: pluralizeCz(events.length, ["událost", "události", "událostí"]),
        }}
        action={
          <div className="flex items-center gap-2">
            <HelpDialog question="Co je Birth Giving?">
              <InfoCard />
            </HelpDialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex gap-1.5">
                  <Plus className="size-4" />
                  Nová událost
                  <ChevronDown className="size-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                  <Sparkles className="size-4" />
                  <span>Nadcházející událost</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/birth-giving/historie/nova">
                    <History className="size-4" />
                    <span>Zapsat proběhlou akci</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Metric progress goals */}
      {!searching && hasAny && (
        <MetricProgress
          goals={[
            {
              current: semesterCount,
              target: BIRTH_GIVING_METRIC.target ?? 2,
              label: "tento semestr",
            },
            {
              current: studyCount,
              target: BIRTH_GIVING_METRIC.totalForStudy ?? 9,
              label: "za studium",
            },
          ]}
        />
      )}

      {hasAny && (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search
              aria-hidden
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={SEARCH_PLACEHOLDER}
              className="pl-9 bg-muted/30 border-border/60"
              aria-label={SEARCH_PLACEHOLDER}
            />
          </div>

          {/* Filter Badges: Všechny, Zúčastnil:a jsem se, Pořádal:a jsem */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {filterBadges.map((badge) => {
              const active = filterMode === badge.id;
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() => setFilterMode(badge.id)}
                  className={cn(
                    "focus-ring inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer select-none",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border/60 bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  <span>{badge.label}</span>
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {badge.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Events List */}
          <div className="pt-1">
            {renderList(displayedEvents)}
          </div>
        </div>
      )}

      {!hasAny && renderList([])}

      {/* Desktop & Mobile Create Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nová Birth Giving událost</DialogTitle>
            <DialogDescription>
              Nastavte parametry události. Podobné události v okolí data
              nabídneme ke kontrole.
            </DialogDescription>
          </DialogHeader>
          <BirthGivingEventForm
            profileId={profileId}
            organizerProfiles={organizerProfiles}
            onSuccess={(created) => {
              setCreateOpen(false);
              router.push(`/birth-giving/${created.id}`);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Mobile Action Menu Dialog */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nová akce</DialogTitle>
            <DialogDescription>
              Vyberte, jaký typ záznamu si přejete vytvořit.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 pt-2">
            <Button
              className="justify-start gap-2 h-11"
              onClick={() => {
                setMobileMenuOpen(false);
                setCreateOpen(true);
              }}
            >
              <Sparkles className="size-4" />
              Nadcházející událost
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-11"
              asChild
              onClick={() => setMobileMenuOpen(false)}
            >
              <Link href="/birth-giving/historie/nova">
                <History className="size-4" />
                Zapsat proběhlou akci
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Floating Action Button */}
      <div onClick={() => setMobileMenuOpen(true)}>
        <MobileFab label="Nová událost" />
      </div>
      <MobileFabSpacer />
    </div>
  );
}