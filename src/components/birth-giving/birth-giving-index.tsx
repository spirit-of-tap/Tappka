"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsTriggerCount } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { BirthGivingEventCard } from "./event-card";
import { BirthGivingEventForm } from "./event-form";
import { groupBirthGivingEvents } from "@/lib/birth-giving/grouping";
import { normalizeBirthGivingSearchQuery } from "@/lib/birth-giving/search";
import type {
  BirthGivingEventIndexItem,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

interface BirthGivingIndexProps {
  events: BirthGivingEventIndexItem[];
  profileId: string;
  now: string;
  organizerProfiles: BirthGivingProfileSummary[];
}

const TAB_LABELS = {
  upcoming: "Nadcházející",
  mine: "Moje",
  history: "Historie",
} as const;

type BirthGivingIndexTab = keyof typeof TAB_LABELS;

const EMPTY_TITLES: Record<BirthGivingIndexTab, string> = {
  upcoming: "Žádné nadcházející události",
  mine: "Žádné události pro tebe",
  history: "Žádné historické události",
};

export function BirthGivingIndex({
  events,
  profileId,
  now,
  organizerProfiles,
}: BirthGivingIndexProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<BirthGivingIndexTab>("upcoming");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const grouped = useMemo(
    () => groupBirthGivingEvents(events, profileId, new Date(now)),
    [events, profileId, now],
  );

  const filtered = useMemo(() => {
    const needle = normalizeBirthGivingSearchQuery(query);
    if (!needle) return grouped;
    const matches = (event: BirthGivingEventIndexItem) => {
      const haystack = normalizeBirthGivingSearchQuery(`${event.name} ${event.customer}`);
      return haystack.includes(needle);
    };
    return {
      upcoming: grouped.upcoming.filter(matches),
      mine: grouped.mine.filter(matches),
      history: grouped.history.filter(matches),
    };
  }, [grouped, query]);

  function renderList(items: BirthGivingEventIndexItem[], tab: BirthGivingIndexTab) {
    if (items.length === 0) {
      return (
        <Empty className="border-dashed">
          <EmptyMedia variant="icon">
            <CalendarDays className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">{EMPTY_TITLES[tab]}</EmptyTitle>
            <EmptyDescription className="text-xs">
              {tab === "upcoming" && "Zkuste později nebo upravte hledání."}
              {tab === "mine" && "Uspořádané, zamýšlené i navržené události se objeví tady."}
              {tab === "history" && "Absolvované události se objeví tady."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }
    return (
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((event) => (
          <BirthGivingEventCard key={event.id} event={event} now={now} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="sm:max-w-sm">
          <InputGroupAddon align="inline-start">
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat událost"
            aria-label="Hledat událost"
          />
        </InputGroup>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="sm:w-auto">
              <Plus className="size-4" />
              Nová událost
            </Button>
          </DialogTrigger>
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
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BirthGivingIndexTab)}>
        <TabsList variant="line">
          {(["upcoming", "mine", "history"] as const).map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {TAB_LABELS[tab]}
              <TabsTriggerCount count={filtered[tab].length} />
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="upcoming" className="mt-4">
          {renderList(filtered.upcoming, "upcoming")}
        </TabsContent>
        <TabsContent value="mine" className="mt-4">
          {renderList(filtered.mine, "mine")}
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          {renderList(filtered.history, "history")}
        </TabsContent>
      </Tabs>
    </div>
  );
}