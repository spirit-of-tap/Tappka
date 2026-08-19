"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderSearch, Rocket, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BirthGivingDuplicateCandidates } from "@/components/birth-giving/duplicate-candidates";
import { ProfileAvatar } from "@/components/profile-avatar";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import { buildBirthGivingRetrospectiveReview } from "@/lib/birth-giving/retrospective";
import type {
  BirthGivingDuplicateCandidateItem,
  BirthGivingEventDetail,
} from "@/lib/birth-giving/types";

interface BirthGivingRetrospectiveReviewStepProps {
  event: BirthGivingEventDetail;
  busy: boolean;
  publishError: string | null;
  onPublish: () => void;
}

export function BirthGivingRetrospectiveReviewStep({
  event,
  busy,
  publishError,
  onPublish,
}: BirthGivingRetrospectiveReviewStepProps) {
  const review = useMemo(() => buildBirthGivingRetrospectiveReview(event), [event]);
  const [duplicates, setDuplicates] = useState<BirthGivingDuplicateCandidateItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void birthGivingMutationRequest<BirthGivingDuplicateCandidateItem[]>(
      "/api/birth-giving/events/duplicate-candidates",
      {
        body: {
          name: event.name,
          customer: event.customer,
          startsAt: event.starts_at,
        },
      },
    ).then((result) => {
      if (!cancelled && result.ok) setDuplicates(result.body.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [event.id, event.name, event.customer, event.starts_at]);

  const issues: string[] = [];
  if (review.assignmentPending) {
    issues.push("Zadání zatím nemá zadaný stav (nahrané nebo nedohledané).");
  }
  if (review.teamsMissing) {
    issues.push("Zatím chybí alespoň jeden tým.");
  }
  for (const issue of review.teamIssues) {
    if (issue.resultStatePending) {
      issues.push(`${issue.team.name} nemá zadaný stav výsledku.`);
    }
    if (issue.resultPresentWithoutFiles) {
      issues.push(`${issue.team.name} je přítomný, ale zatím nemá žádný soubor.`);
    }
    if (!issue.sizeValid) {
      issues.push(
        `${issue.team.name} má ${issue.memberCount} ${memberWord(issue.memberCount)}, což nesplňuje rozmezí ${event.minimum_team_size}–${event.maximum_team_size}.`,
      );
    }
  }

  const missingDocumentTeams = review.teamIssues.filter(
    ({ team }) => team.result_state === "missing",
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="gap-1">
          <Users className="size-3" />
          {review.teamIssues.length} {pluralizeTeams(review.teamIssues.length)}
        </Badge>
        <Badge variant="outline" className="gap-1">
          {review.affectedProfiles.length} {pluralizePeople(review.affectedProfiles.length)} v týmech
        </Badge>
      </div>

      <Card className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Kontrola připravenosti
          </h2>
          {issues.length === 0 && (
            <Badge className="gap-1">
              <CheckCircle2 className="size-3" />
              Bez blokujících chyb
            </Badge>
          )}
        </div>

        {issues.length > 0 ? (
          <Alert className="border-warning/40 bg-warning/5 text-warning-strong">
            <AlertTriangle className="size-4" />
            <AlertTitle>Před zveřejněním je potřeba doplnit</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <p className="mt-2">
                Nedohledané dokumenty zveřejnění nebrání.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          !review.assignmentPending && (
            <p className="text-sm text-muted-foreground">
              Událost je připravená ke zveřejnění.
            </p>
          )
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Nedohledané dokumenty</h3>
          <div className="flex flex-wrap items-center gap-2">
            {event.assignment?.state === "missing" && (
              <Badge variant="outline" className="gap-1">
                <FolderSearch className="size-3" />
                Zadání nedohledáno
              </Badge>
            )}
            <ul className="contents">
              {missingDocumentTeams.map(({ team }) => (
                <li key={team.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <FolderSearch className="size-3" />
                    {team.name}
                  </Badge>
                  <Badge variant="outline">Výsledek nedohledán</Badge>
                </li>
              ))}
            </ul>
            {event.assignment?.state !== "missing"
              && missingDocumentTeams.length === 0
              && (
                <span className="text-sm text-muted-foreground">
                  Žádné nedohledané dokumenty.
                </span>
              )}
          </div>
        </div>
      </Card>

      <BirthGivingDuplicateCandidates candidates={duplicates} />

      <Card className="space-y-3 p-3 sm:p-4">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Komu se zvýší počet BG
        </h3>
        {review.affectedProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Zatím nejsou v týmech žádné osoby.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {review.affectedProfiles.map((profile) => (
              <li
                key={profile.id}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-sm"
              >
                <ProfileAvatar picture={profile.picture} name={profile.name} size={24} />
                <span className="min-w-0 truncate">{profile.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {publishError && (
        <Alert role="alert" className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Zveřejnění se nezdařilo</AlertTitle>
          <AlertDescription>{publishError}</AlertDescription>
        </Alert>
      )}

      {event.status === "draft" && (
        <div className="flex items-center justify-end">
          <Button type="button" disabled={busy} onClick={onPublish}>
            <Rocket className="size-4" />
            Zveřejnit událost
          </Button>
        </div>
      )}
    </div>
  );
}

function memberWord(count: number): string {
  if (count === 1) return "člena";
  if (count >= 2 && count <= 4) return "členy";
  return "členů";
}

function pluralizeTeams(count: number): string {
  if (count === 1) return "tým";
  if (count >= 2 && count <= 4) return "týmy";
  return "týmů";
}

function pluralizePeople(count: number): string {
  if (count === 1) return "osoba";
  if (count >= 2 && count <= 4) return "osoby";
  return "osob";
}