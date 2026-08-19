"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BirthGivingProfilePicker } from "./profile-picker";
import { BirthGivingDuplicateCandidates, type BirthGivingDuplicateCandidateItem } from "./duplicate-candidates";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import { parseBirthGivingDateTimeInput } from "@/lib/birth-giving/time";
import type {
  BirthGivingDuration,
  BirthGivingEventDetail,
  BirthGivingEventStatus,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

interface BirthGivingEventFormProps {
  event?: BirthGivingEventDetail;
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
  onSuccess: (event: BirthGivingEventDetail) => void;
  onCancel: () => void;
}

interface BirthGivingDraftPayload {
  name: string;
  customer: string;
  startsAt: string;
  duration: BirthGivingDuration;
  minimumTeamSize: number;
  maximumTeamSize: number;
  joiningOpen: boolean;
  organizerProfileIds: string[];
}

export function BirthGivingEventForm({
  event,
  profileId,
  organizerProfiles,
  onSuccess,
  onCancel,
}: BirthGivingEventFormProps) {
  const isEdit = event !== undefined;
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
  const [joiningOpen, setJoiningOpen] = useState(event?.joining_open ?? true);
  const [selectedOrganizers, setSelectedOrganizers] = useState<string[]>(() => {
    if (event) return event.organizers.map((organizer) => organizer.profile_id);
    return [profileId];
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<BirthGivingDuplicateCandidateItem[]>([]);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<BirthGivingDraftPayload | null>(null);

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedCustomer = customer.trim();
    const min = Number(minimumTeamSize);
    const max = Number(maximumTeamSize);
    if (!trimmedName) { setError("Název události je povinný"); return; }
    if (!trimmedCustomer) { setError("Zákazník je povinný"); return; }
    if (!startsAt) { setError("Začátek je povinný"); return; }
    const startsAtDate = parseBirthGivingDateTimeInput(startsAt);
    if (startsAtDate === null) {
      toast.error("Zadejte platné datum začátku");
      return;
    }
    if (!Number.isInteger(min) || min < 1) { setError("Min. velikost týmu je neplatná"); return; }
    if (!Number.isInteger(max) || max < min) { setError("Max. velikost týmu musí být aspoň minimální"); return; }
    if (selectedOrganizers.length === 0) { setError("Vyberte alespoň jednoho organizátor:ku"); return; }

    const payload: BirthGivingDraftPayload = {
      name: trimmedName,
      customer: trimmedCustomer,
      startsAt: startsAtDate.toISOString(),
      duration,
      minimumTeamSize: min,
      maximumTeamSize: max,
      joiningOpen,
      organizerProfileIds: withCaller(selectedOrganizers),
    };
    setPendingPayload(payload);

    setLoading(true);
    try {
      if (!isEdit && !duplicateConfirmed) {
        const check = await birthGivingMutationRequest<BirthGivingDuplicateCandidateItem[]>(
          "/api/birth-giving/events/duplicate-candidates",
          {
            body: {
              name: payload.name,
              customer: payload.customer,
              startsAt: payload.startsAt,
            },
          },
        );
        if (!check.ok) {
          toast.error(check.body.error ?? "Kontrolu podobných událostí se nepodařilo dokončit");
          return;
        }
        const candidates = check.body.data ?? [];
        if (candidates.length > 0) {
          setDuplicates(candidates);
          return;
        }
      }
      await createEvent(payload);
    } finally {
      setLoading(false);
    }
  }

  async function createEvent(payload: BirthGivingDraftPayload) {
    const path = isEdit ? `/api/birth-giving/events/${event.id}` : "/api/birth-giving/events";
    const result = await birthGivingMutationRequest(path, {
      method: isEdit ? "PATCH" : "POST",
      body: payload,
    });
    if (result.ok && result.body.data) {
      toast.success(isEdit ? "Událost byla aktualizována" : "Událost byla vytvořena");
      onSuccess(result.body.data);
      return;
    }
    if (result.body.code === "DUPLICATE_EVENT") {
      const candidate = toDuplicateCandidate(result.body.data);
      if (candidate) setDuplicates([candidate]);
      return;
    }
    toast.error(result.body.error ?? "Událost se nepodařilo uložit");
  }

  function continueAfterDuplicateConfirmation() {
    if (!pendingPayload) return;
    setDuplicateConfirmed(true);
    setLoading(true);
    void createEvent(pendingPayload).finally(() => setLoading(false));
  }

  function withCaller(organizerIds: string[]): string[] {
    if (organizerIds.includes(profileId)) return organizerIds;
    return [profileId, ...organizerIds];
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <BirthGivingDuplicateCandidates candidates={duplicates} />
      {duplicates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {!duplicateConfirmed && (
            <Button
              type="button"
              size="sm"
              disabled={loading}
              onClick={continueAfterDuplicateConfirmation}
            >
              {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
              Je to jiná událost. Pokračovat
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDuplicates([]);
              setDuplicateConfirmed(false);
            }}
          >
            Vrátit se k formuláři
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bg-event-name">Název události</Label>
          <Input
            id="bg-event-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Např. Letní BG"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bg-event-customer">Zákazník</Label>
          <Input
            id="bg-event-customer"
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            placeholder="Název zákazníka"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bg-event-start">Začátek</Label>
          <Input
            id="bg-event-start"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Délka</Label>
          <Select value={duration} onValueChange={(value) => setDuration(value as BirthGivingDuration)}>
            <SelectTrigger aria-label="Délka">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BIRTH_GIVING_DURATION_LABELS) as BirthGivingDuration[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {BIRTH_GIVING_DURATION_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bg-event-min-size">Min. velikost týmu</Label>
          <Input
            id="bg-event-min-size"
            type="number"
            min={1}
            value={minimumTeamSize}
            onChange={(event) => setMinimumTeamSize(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bg-event-max-size">Max. velikost týmu</Label>
          <Input
            id="bg-event-max-size"
            type="number"
            min={1}
            value={maximumTeamSize}
            onChange={(event) => setMaximumTeamSize(event.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-md border p-3">
        <Label htmlFor="bg-event-joining">Otevřené přihlašování</Label>
        <Switch
          id="bg-event-joining"
          checked={joiningOpen}
          onCheckedChange={setJoiningOpen}
        />
      </div>

      <BirthGivingProfilePicker
        profiles={organizerProfiles}
        selected={selectedOrganizers}
        onChange={(next) => setSelectedOrganizers(withCaller(next))}
        label="Organizátor:ky"
        placeholder="Vyberte organizátor:ky"
      />

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          {isEdit ? "Uložit změny" : "Vytvořit událost"}
        </Button>
      </div>
    </form>
  );
}

function toDuplicateCandidate(
  data: unknown,
): BirthGivingDuplicateCandidateItem | null {
  if (typeof data !== "object" || data === null) return null;
  const candidate = data as {
    id?: string;
    status?: BirthGivingEventStatus;
    identity?: { eventName?: string; customer?: string; startsAt?: string };
    name?: string;
    customer?: string;
    starts_at?: string;
  };
  if (typeof candidate.id !== "string") return null;
  const identity = candidate.identity;
  const name = identity?.eventName ?? candidate.name ?? "";
  const customer = identity?.customer ?? candidate.customer ?? "";
  const startsAt = identity?.startsAt ?? candidate.starts_at ?? "";
  if (!name || !customer || !startsAt) return null;
  return {
    id: candidate.id,
    status: candidate.status ?? "published",
    name,
    customer,
    starts_at: startsAt,
  };
}