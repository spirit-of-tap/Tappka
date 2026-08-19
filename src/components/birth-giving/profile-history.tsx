import Link from "next/link";
import { CalendarDays, Trophy } from "lucide-react";

import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import type { BirthGivingProfileHistoryItem } from "@/lib/birth-giving/types";

interface BirthGivingProfileHistoryProps {
  items: BirthGivingProfileHistoryItem[];
}

export function BirthGivingProfileHistory({ items }: BirthGivingProfileHistoryProps) {
  if (items.length === 0) {
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

  return (
    <ItemGroup>
      {items.map((item) => {
        const startsAt = new Date(item.starts_at);
        return (
          <Item key={item.id} asChild>
            <Link
              href={`/birth-giving/${item.id}`}
              className="w-full rounded-md focus-ring"
            >
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
              </ItemContent>
              <ItemActions>
                <Badge variant="outline" className="text-muted-foreground">
                  {startsAt.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
                </Badge>
              </ItemActions>
            </Link>
          </Item>
        );
      })}
    </ItemGroup>
  );
}