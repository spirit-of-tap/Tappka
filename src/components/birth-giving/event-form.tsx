"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BirthGivingProfilePicker } from "./profile-picker";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import { BIRTH_GIVING_DURATION_LABELS } from "@/lib/birth-giving/constants";
import { parseBirthGivingDateTimeInput } from "@/lib/birth-giving/time";
import type {
  BirthGivingDuration,
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
} from "@/lib/birth-giving/types";

interface BirthGivingEventFormProps {
  event?: BirthGivingEventDetail;
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
  onSuccess: (event: BirthGivingEventDetail) => void;
  onCancel: () => void;
}

interface BirthGivingPayload {
  name: string;
  customer: string;
  startsAt: string;
  duration: BirthGivingDuration;
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
  const [selectedOrganizers, setSelectedOrganizers] = useState<string[]>(() => {
    if (event?.organizer_profile_ids) return event.organizer_profile_ids;
    if (event?.organizers) return event.organizers.map((o) => o.id);
    return [profileId];
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formEvent: React.FormEvent) {
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

    const payload: BirthGivingPayload = {
      name: trimmedName,
      customer: trimmedCustomer,
      startsAt: startsAtDate.toISOString(),
      duration,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bg-event-name">Název události</Label>
          <Input
            id="bg-event-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. Letní BG"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bg-event-customer">Zákazník</Label>
          <Input
            id="bg-event-customer"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
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
            onChange={(e) => setStartsAt(e.target.value)}
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

      <BirthGivingProfilePicker
        profiles={organizerProfiles}
        selected={selectedOrganizers}
        onChange={(next) => setSelectedOrganizers(withCaller(next))}
        label="Organizátoři:ky"
        placeholder="Vyberte organizátory:ky"
      />

      <div className="flex items-center justify-end gap-2 pt-2">
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