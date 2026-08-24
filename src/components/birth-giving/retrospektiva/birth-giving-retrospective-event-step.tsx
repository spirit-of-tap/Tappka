"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { BirthGivingProfilePicker } from "@/components/birth-giving/profile-picker";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import { parseBirthGivingDateTimeInput } from "@/lib/birth-giving/time";
import type {
  BirthGivingDuration,
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

export interface BirthGivingRetrospectiveEventPayload {
  name: string;
  customer: string;
  startsAt: string;
  duration: BirthGivingDuration;
  organizerProfileIds: string[];
}

interface BirthGivingRetrospectiveEventStepProps {
  event: BirthGivingEventDetail | null;
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
  busy: boolean;
  onSubmit: (payload: BirthGivingRetrospectiveEventPayload) => void;
}

export function BirthGivingRetrospectiveEventStep({
  event,
  profileId,
  organizerProfiles,
  busy,
  onSubmit,
}: BirthGivingRetrospectiveEventStepProps) {
  const [name, setName] = useState(event?.name ?? "");
  const [customer, setCustomer] = useState(event?.customer ?? "");
  const [startsAt, setStartsAt] = useState(
    event?.starts_at ? event.starts_at.slice(0, 16) : "",
  );
  const [duration, setDuration] = useState<BirthGivingDuration>(event?.duration ?? "8h");
  const [selectedOrganizers, setSelectedOrganizers] = useState<string[]>(() => {
    if (event?.organizer_profile_ids) return event.organizer_profile_ids;
    if (event?.organizers) return event.organizers.map((o) => o.id);
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
    if (!trimmedName) { setError("Název události je povinný"); return; }
    if (!trimmedCustomer) { setError("Zákazník je povinný"); return; }
    if (!startsAt) { setError("Začátek je povinný"); return; }
    const startsAtDate = parseBirthGivingDateTimeInput(startsAt);
    if (startsAtDate === null) {
      toast.error("Zadejte platné datum začátku");
      return;
    }
    if (selectedOrganizers.length === 0) { setError("Vyberte alespoň jednoho organizátor:ku"); return; }

    onSubmit({
      name: trimmedName,
      customer: trimmedCustomer,
      startsAt: startsAtDate.toISOString(),
      duration,
      organizerProfileIds: withCaller(selectedOrganizers),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bg-retro-name">Název události</Label>
          <Input
            id="bg-retro-name"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. Letní BG 2024"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bg-retro-customer">Zákazník</Label>
          <Input
            id="bg-retro-customer"
            value={customer}
            disabled={busy}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Název zákazníka"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bg-retro-starts-at">Začátek</Label>
          <Input
            id="bg-retro-starts-at"
            type="datetime-local"
            value={startsAt}
            disabled={busy}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Délka</Label>
          <Select
            value={duration}
            disabled={busy}
            onValueChange={(val) => setDuration(val as BirthGivingDuration)}
          >
            <SelectTrigger aria-label="Délka">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BIRTH_GIVING_DURATION_LABELS) as BirthGivingDuration[]).map((val) => (
                <SelectItem key={val} value={val}>
                  {BIRTH_GIVING_DURATION_LABELS[val]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <BirthGivingProfilePicker
        profiles={organizerProfiles}
        selected={selectedOrganizers}
        onChange={(next) => setSelectedOrganizers(withCaller(next))}
        label="Organizátoři:ky"
        placeholder="Vyberte organizátory:ky"
        disabled={busy}
      />

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          Uložit a pokračovat
        </Button>
      </div>
    </form>
  );
}