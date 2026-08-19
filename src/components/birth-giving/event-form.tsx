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

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);
    setDuplicates([]);

    const trimmedName = name.trim();
    const trimmedCustomer = customer.trim();
    const min = Number(minimumTeamSize);
    const max = Number(maximumTeamSize);
    if (!trimmedName) { setError("Název události je povinný"); return; }
    if (!trimmedCustomer) { setError("Zákazník je povinný"); return; }
    if (!startsAt) { setError("Začátek je povinný"); return; }
    if (!Number.isInteger(min) || min < 1) { setError("Min. velikost týmu je neplatná"); return; }
    if (!Number.isInteger(max) || max < min) { setError("Max. velikost týmu musí být aspoň minimální"); return; }
    if (selectedOrganizers.length === 0) { setError("Vyberte alespoň jednoho organizátor:ku"); return; }

    const payload = {
      name: trimmedName,
      customer: trimmedCustomer,
      startsAt: new Date(startsAt).toISOString(),
      duration,
      minimumTeamSize: min,
      maximumTeamSize: max,
      joiningOpen,
      organizerProfileIds: withCaller(selectedOrganizers),
    };

    setLoading(true);
    try {
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
    } finally {
      setLoading(false);
    }
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDuplicates([])}
        >
          Vrátit se k formuláři
        </Button>
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
  };
  if (typeof candidate.id !== "string" || !candidate.identity) return null;
  return {
    id: candidate.id,
    status: candidate.status ?? "published",
    name: candidate.identity.eventName ?? "",
    customer: candidate.identity.customer ?? "",
    starts_at: candidate.identity.startsAt ?? "",
  };
}