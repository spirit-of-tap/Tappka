"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BirthGivingProfilePicker } from "./profile-picker";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
  BirthGivingTeamDetail,
} from "@/lib/birth-giving/types";

interface BirthGivingTeamFormProps {
  eventId: string;
  callerProfileId: string;
  availableProfiles: BirthGivingProfileSummary[];
  team?: BirthGivingTeamDetail;
  onSuccess: (event: BirthGivingEventDetail | null) => void;
  onCancel: () => void;
}

export function BirthGivingTeamForm({
  eventId,
  callerProfileId,
  availableProfiles,
  team,
  onSuccess,
  onCancel,
}: BirthGivingTeamFormProps) {
  const isEdit = Boolean(team);
  const [name, setName] = useState(team?.name ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(
    () => team?.members.map((m) => m.profile_id) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Název týmu je povinný");
      return;
    }
    setLoading(true);
    try {
      const path = isEdit && team
        ? `/api/birth-giving/events/${eventId}/teams/${team.id}`
        : `/api/birth-giving/events/${eventId}/teams`;
      const result = await birthGivingMutationRequest(path, {
        method: isEdit ? "PATCH" : "POST",
        body: {
          name: trimmed,
          memberProfileIds: memberIds,
        },
      });
      if (result.ok && result.body.data) {
        toast.success(isEdit ? "Tým byl upraven" : "Tým byl vytvořen");
        onSuccess(result.body.data);
      } else {
        toast.error(result.body.error ?? (isEdit ? "Tým se nepodařilo upravit" : "Tým se nepodařilo vytvořit"));
        if (!result.body.data) onSuccess(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-2">
        <Label htmlFor="bg-team-name">Název týmu</Label>
        <Input
          id="bg-team-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Např. Tým Alfa"
        />
      </div>

      <div className="space-y-2">
        <BirthGivingProfilePicker
          profiles={availableProfiles}
          selected={memberIds}
          onChange={setMemberIds}
          excludeIds={isEdit ? [] : [callerProfileId]}
          label={isEdit ? "Členové:ky týmu" : "Přidat další členy:ky"}
          placeholder="Vyberte členy:ky týmu"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Zrušit
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          {isEdit ? "Uložit změny" : "Vytvořit tým"}
        </Button>
      </div>
    </form>
  );
}