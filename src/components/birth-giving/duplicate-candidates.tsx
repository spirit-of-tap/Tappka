import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { BirthGivingEventStatus } from "@/lib/birth-giving/types";

export interface BirthGivingDuplicateCandidateItem {
  id: string;
  name: string;
  customer: string;
  starts_at: string;
  status: BirthGivingEventStatus;
}

interface BirthGivingDuplicateCandidatesProps {
  candidates: BirthGivingDuplicateCandidateItem[];
}

const STATUS_LABELS: Record<BirthGivingEventStatus, string> = {
  draft: "Draft",
  published: "Zveřejněná",
};

export function BirthGivingDuplicateCandidates({
  candidates,
}: BirthGivingDuplicateCandidatesProps) {
  if (candidates.length === 0) return null;

  return (
    <Alert className="border-warning/40 bg-warning/5 text-warning-strong">
      <AlertTriangle className="size-4" />
      <AlertTitle>Podobná událost už existuje</AlertTitle>
      <AlertDescription>
        <p>
          Níže jsou podobné události z okolí stejného data. Zkontrolujte, jestli
          některá z nich není tou stejnou událostí.
        </p>
        <ul className="mt-3 space-y-2">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <Link href={`/birth-giving/${candidate.id}`} className="block rounded-md focus-ring">
                <Card className="flex items-center justify-between gap-2 p-2 text-sm hover:bg-accent/50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{candidate.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {candidate.customer}
                    </span>
                  </span>
                  <Badge variant="outline" className="text-muted-foreground">
                    {STATUS_LABELS[candidate.status]}
                  </Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}