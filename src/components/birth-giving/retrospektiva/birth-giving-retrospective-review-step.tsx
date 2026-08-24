"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Rocket, Users } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProfileAvatar } from "@/components/profile-avatar";
import { buildBirthGivingRetrospectiveReview } from "@/lib/birth-giving/retrospective";
import type { BirthGivingEventDetail } from "@/lib/birth-giving/types";

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

  const issues: string[] = [];
  if (review.teamsMissing) {
    issues.push("Zatím chybí alespoň jeden tým.");
  }
  for (const issue of review.teamIssues) {
    if (issue.memberCount === 0) {
      issues.push(`Tým ${issue.team.name} nemá žádné členy:ky.`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="gap-1">
          <Users className="size-3" />
          {review.teamIssues.length} týmů
        </Badge>
        <Badge variant="outline" className="gap-1">
          {review.affectedProfiles.length} lidí v týmech
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
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Před zveřejněním je třeba opravit následující:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-1 pt-1">
                {issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm text-muted-foreground">
            Všechny povinné údaje jsou vyplněné. Můžete událost zveřejnit.
          </p>
        )}

        {publishError && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Chyba při zveřejnění</AlertTitle>
            <AlertDescription>{publishError}</AlertDescription>
          </Alert>
        )}
      </Card>

      {review.affectedProfiles.length > 0 && (
        <Card className="space-y-2 p-3 sm:p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase">
            Zúčastnění lidé
          </h3>
          <div className="flex flex-wrap gap-2">
            {review.affectedProfiles.map((profile) => (
              <span
                key={profile.id}
                className="flex items-center gap-1.5 rounded-full border bg-muted/40 py-0.5 pl-0.5 pr-2 text-xs"
              >
                <ProfileAvatar picture={profile.picture} name={profile.name} size={18} />
                <span>{profile.name}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          type="button"
          disabled={busy || issues.length > 0}
          onClick={onPublish}
        >
          <Rocket className="size-4" />
          Zveřejnit událost
        </Button>
      </div>
    </div>
  );
}