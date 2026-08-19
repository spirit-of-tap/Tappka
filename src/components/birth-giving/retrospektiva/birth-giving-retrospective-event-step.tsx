"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BirthGivingDuplicateCandidates } from "@/components/birth-giving/duplicate-candidates";
import { BirthGivingProfilePicker } from "@/components/birth-giving/profile-picker";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import { parseBirthGivingDateTimeInput } from "@/lib/birth-giving/time";
import type {
  BirthGivingDuplicateCandidateItem,
  BirthGivingDuration,
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

export interface BirthGivingRetrospectiveEventPayload {
  name: string;
  customer: string;
  startsAt: string;
  duration: BirthGivingDuration;
  minimumTeamSize: number;
  maximumTeamSize: number;
  joiningOpen: boolean;
  organizerProfileIds: string[];
}

interface BirthGivingRetrospectiveEventStepProps {
  event: BirthGivingEventDetail | null;
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
  busy: boolean;
  duplicates: BirthGivingDuplicateCandidateItem[];
  resumeDraftId: string | null;
  onSubmit: (payload: BirthGivingRetrospectiveEventPayload) => void;
  onConfirmDuplicate: () => void;
  onCancelDuplicate: () => void;
  onResumeDraft: () => void;
}

export function BirthGivingRetrospectiveEventStep({
  event,
  profileId,
  organizerProfiles,
  busy,
  duplicates,
  resumeDraftId,
  onSubmit,
  onConfirmDuplicate,
  onCancelDuplicate,
  onResumeDraft,
}: BirthGivingRetrospectiveEventStepProps) {
  const [name, setName] = useState(event?.name ?? "");
  const [customer, setCustomer] = useState(event?.customer ?? "");
  const [startsAt, setStartsAt] = useState(
    event?.starts_at ? event.starts_at.slice(0, 16) : "",
  );
  const [duration, setDuration] = useState<BirthGivingDuration>(event?.duration ?? "8h");
  const [minimumTeamSize, setMinimumTeamSize] = useState(
    event?.minimum_team_size.toString() ?? "2",
  );
  const [maximumTeamSize, setMaximumTeamSize] = useState(
    event?.maximum_team_size.toString() ?? "4",
  );
  const [selectedOrganizers, setSelectedOrganizers] = useState<string[]>(() => {
    if (event) return event.organizers.map((organizer) => organizer.profile_id);
    return [profileId];
  });
  const [error, setError] = useState<string | null>(null);

  function withCaller(organizerIds: string[]): string[] {
    if (organizerIds.includes(profileId)) return organizerIds;
    return [profileId, ...organizerIds];
  }

  function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedCustomer = customer.trim();
    const min = Number(minimumTeamSize);
    const max = Number(maximumTeamSize);
    if (!trimmedName) {
      setError("Název události je povinný");
      return;
    }
    if (!trimmedCustomer) {
      setError("Zákazník je povinný");
      return;
    }
    if (!startsAt) {
      setError("Začátek je povinný");
      return;
    }
    const startsAtDate = parseBirthGivingDateTimeInput(startsAt);
    if (startsAtDate === null) {
      toast.error("Zadejte platné datum začátku");
      return;
    }
    if (startsAtDate.getTime() >= Date.now()) {
      setError("Začátek historické události musí být v minulosti");
      return;
    }
    if (!Number.isInteger(min) || min < 1) {
      setError("Min. velikost týmu je neplatná");
      return;
    }
    if (!Number.isInteger(max) || max < min) {
      setError("Max. velikost týmu musí být aspoň minimální");
      return;
    }
    if (selectedOrganizers.length === 0) {
      setError("Vyberte alespoň jednoho organizátor:ku");
      return;
    }

    onSubmit({
      name: trimmedName,
      customer: trimmedCustomer,
      startsAt: startsAtDate.toISOString(),
      duration,
      minimumTeamSize: min,
      maximumTeamSize: max,
      joiningOpen: false,
      organizerProfileIds: withCaller(selectedOrganizers),
    });
  }

  return (
    <div className="space-y-4">
      {resumeDraftId && (
        <Alert className="border-info/40 bg-info/5 text-info-strong">
          <AlertTitle>Rozepsaný koncept existuje</AlertTitle>
          <AlertDescription>
            <p>
              Přesně stejná událost už má rozepsaný koncept. Můžete v něm pokračovat,
              nebo se vrátit k údajům.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={onResumeDraft}
              >
                {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
                Pokračovat v rozepsaném konceptu
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={onCancelDuplicate}
              >
                Vrátit se k údajům
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <BirthGivingDuplicateCandidates candidates={duplicates} />
      {duplicates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={onConfirmDuplicate}
          >
            {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
            Je to jiná událost. Pokračovat
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onCancelDuplicate}
          >
            Vrátit se k formuláři
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bg-historical-event-name">Název události</Label>
            <Input
              id="bg-historical-event-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Např. Letní BG"
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bg-historical-event-customer">Zákazník</Label>
            <Input
              id="bg-historical-event-customer"
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              placeholder="Název zákazníka"
              disabled={busy}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bg-historical-event-start">Začátek</Label>
            <Input
              id="bg-historical-event-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label>Délka</Label>
            <Select
              value={duration}
              onValueChange={(value) => setDuration(value as BirthGivingDuration)}
              disabled={busy}
            >
              <SelectTrigger aria-label="Délka">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(BIRTH_GIVING_DURATION_LABELS) as BirthGivingDuration[]).map(
                  (value) => (
                    <SelectItem key={value} value={value}>
                      {BIRTH_GIVING_DURATION_LABELS[value]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bg-historical-event-min-size">Min. velikost týmu</Label>
            <Input
              id="bg-historical-event-min-size"
              type="number"
              min={1}
              value={minimumTeamSize}
              onChange={(event) => setMinimumTeamSize(event.target.value)}
              disabled={busy}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bg-historical-event-max-size">Max. velikost týmu</Label>
            <Input
              id="bg-historical-event-max-size"
              type="number"
              min={1}
              value={maximumTeamSize}
              onChange={(event) => setMaximumTeamSize(event.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          U historické události zůstává sestavování týmů zavřené.
        </p>

        <BirthGivingProfilePicker
          profiles={organizerProfiles}
          selected={selectedOrganizers}
          onChange={(next) => setSelectedOrganizers(withCaller(next))}
          label="Organizátor:ky"
          placeholder="Vyberte organizátor:ky"
          disabled={busy}
        />

        <div className="flex items-center justify-end gap-2">
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
            {event ? "Uložit koncept" : "Vytvořit koncept"}
          </Button>
        </div>
      </form>
    </div>
  );
}