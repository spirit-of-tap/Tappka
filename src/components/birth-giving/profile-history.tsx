import Link from "next/link";
import { CalendarDays, Trophy } from "lucide-react";

import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import type { BirthGivingProfileHistoryItem } from "@/lib/birth-giving/types";

interface BirthGivingProfileHistoryProps {
  items: BirthGivingProfileHistoryItem[];
}

function isValidParticipation(item: BirthGivingProfileHistoryItem): boolean {
  return (
    item.membership.frozen_at !== null &&
    item.team.status !== "cancelled" &&
    item.status === "published" &&
    item.removed_at === null
  );
}

export function BirthGivingProfileHistory({ items }: BirthGivingProfileHistoryProps) {
  const validItems = items.filter(isValidParticipation);

  if (validItems.length === 0) {
    return (
      <Empty>
        <EmptyMedia variant="icon">
          <Trophy className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Žádná absolvovaná participace</EmptyTitle>
          <EmptyDescription>
            Zatím žádné zveřejněné Birth Giving participace v platném týmu.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const byYear = new Map<number, BirthGivingProfileHistoryItem[]>();
  for (const item of validItems) {
    const year = new Date(item.starts_at).getFullYear();
    const group = byYear.get(year);
    if (group) group.push(item);
    else byYear.set(year, [item]);
  }

  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {years.map((year) => {
        const groupItems = [...(byYear.get(year) ?? [])].sort(
          (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
        );
        return (
          <section key={year} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{year}</h3>
              <Badge variant="secondary">{groupItems.length}</Badge>
            </div>
            <ItemGroup>
              {groupItems.map((item) => {
                const startsAt = new Date(item.starts_at);
                const dateLabel = startsAt.toLocaleDateString("cs-CZ", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
                const durationLabel = BIRTH_GIVING_DURATION_LABELS[item.duration];
                const organizerNames = item.organizers.map((organizer) => organizer.profile.name).join(", ");
                return (
                  <Item key={item.id} asChild>
                    <Link href={`/birth-giving/${item.id}`} className="w-full rounded-md focus-ring">
                      <ItemMedia variant="icon">
                        <CalendarDays className="size-4" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          <span className="truncate">{item.name}</span>
                        </ItemTitle>
                        <ItemDescription>
                          {item.customer} · {item.team.name}
                        </ItemDescription>
                        <p className="text-xs text-muted-foreground">
                          {dateLabel} · {durationLabel} · Organizátor:ky {organizerNames}
                        </p>
                      </ItemContent>
                    </Link>
                  </Item>
                );
              })}
            </ItemGroup>
          </section>
        );
      })}
    </div>
  );
}