"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { BirthGivingResultFileList } from "@/components/birth-giving/result-file-list";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
  BirthGivingTeamDetail,
  BirthGivingTeamResultState,
} from "@/lib/birth-giving/types";

interface BirthGivingRetrospectiveTeamsStepProps {
  event: BirthGivingEventDetail;
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
  now: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

export function BirthGivingRetrospectiveTeamsStep({
  event,
  profileId,
  organizerProfiles,
  now,
  onEventChange,
}: BirthGivingRetrospectiveTeamsStepProps) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const teams = event.teams.filter(({ status }) => status !== "cancelled");

  async function refreshAfterMutation(updated: BirthGivingEventDetail | null) {
    onEventChange(updated);
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vytvořte každý skutečný tým, vyberte osoby z existujících profilů a nahrajte
        soubory s výsledky. Každá osoba smí být v jediném týmu.
      </p>

      {teams.length === 0 && (
        <Empty className="border-dashed">
          <EmptyMedia variant="icon">
            <Users className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">Zatím nejsou vytvořené žádné týmy.</EmptyTitle>
            <EmptyDescription className="text-xs">
              Přidejte první tým, abyste mohli retrospektivu dokončit.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <div className="space-y-3">
        {teams.map((team) => (
          <BirthGivingRetrospectiveTeamEditor
            key={team.id}
            event={event}
            team={team}
            profileId={profileId}
            organizerProfiles={organizerProfiles}
            now={now}
            otherTeamMemberIds={otherTeamMemberProfileIds(event, team.id)}
            onEventChange={refreshAfterMutation}
          />
        ))}
      </div>

      {adding ? (
        <BirthGivingRetrospectiveTeamCreate
          event={event}
          organizerProfiles={organizerProfiles}
          busy={busy}
          onCreated={(updated) => {
            setAdding(false);
            void refreshAfterMutation(updated);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" />
          Přidat tým
        </Button>
      )}
    </div>
  );
}

function otherTeamMemberProfileIds(
  event: BirthGivingEventDetail,
  teamId: string,
): string[] {
  return event.teams
    .filter(({ id, status }) => id !== teamId && status !== "cancelled")
    .flatMap(({ members }) => members.map(({ profile_id }) => profile_id));
}

interface BirthGivingRetrospectiveTeamEditorProps {
  event: BirthGivingEventDetail;
  team: BirthGivingTeamDetail;
  profileId: string;
  organizerProfiles: BirthGivingProfileSummary[];
  now: string;
  otherTeamMemberIds: string[];
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

function BirthGivingRetrospectiveTeamEditor({
  event,
  team,
  profileId,
  organizerProfiles,
  now,
  otherTeamMemberIds,
  onEventChange,
}: BirthGivingRetrospectiveTeamEditorProps) {
  const [name, setName] = useState(team.name);
  const [saving, setSaving] = useState(false);

  const memberProfileIds = team.members.map(({ profile_id }) => profile_id);
  const sizeValid =
    memberProfileIds.length >= event.minimum_team_size
    && memberProfileIds.length <= event.maximum_team_size;

  async function patchTeam(changes: {
    name?: string;
    memberProfileIds?: string[];
    resultState?: BirthGivingTeamResultState;
  }) {
    setSaving(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/historical-teams/${team.id}`,
        {
          method: "PATCH",
          body: {
            name: changes.name ?? (name.trim() || team.name),
            memberProfileIds: changes.memberProfileIds ?? memberProfileIds,
            resultState: changes.resultState ?? team.result_state,
          },
        },
      );
      if (result.ok && result.body.data) {
        onEventChange(result.body.data);
        return;
      }
      toast.error(result.body.error ?? "Tým se nepodařilo uložit");
      onEventChange(result.body.data ?? null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{team.name}</h3>
        {team.result_state === "missing" && (
          <Badge variant="outline" className="gap-1">
            Výsledek nedohledán
          </Badge>
        )}
        {!sizeValid && (
          <Badge variant="destructive" className="gap-1">
            Velikost týmu mimo rozmezí {event.minimum_team_size}–{event.maximum_team_size}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`bg-historical-team-name-${team.id}`}>Název týmu</Label>
          <Input
            id={`bg-historical-team-name-${team.id}`}
            value={name}
            disabled={saving}
            onChange={(changeEvent) => setName(changeEvent.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== team.name) void patchTeam({ name: name.trim() });
            }}
          />
        </div>
        <div className="space-y-2">
          <BirthGivingProfilePicker
            profiles={organizerProfiles}
            selected={memberProfileIds}
            onChange={(next) => void patchTeam({ memberProfileIds: next })}
            label="Člen:ky týmu"
            placeholder="Vyberte osoby"
            excludeIds={otherTeamMemberIds}
            disabled={saving}
          />
        </div>
      </div>

      {team.result_state === "missing" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => void patchTeam({ resultState: "present" })}
        >
          Označit výsledek jako přítomný
        </Button>
      ) : (
        <BirthGivingResultFileList
          event={event}
          team={team}
          profileId={profileId}
          now={now}
          onEventChange={onEventChange}
        />
      )}
    </Card>
  );
}

interface BirthGivingRetrospectiveTeamCreateProps {
  event: BirthGivingEventDetail;
  organizerProfiles: BirthGivingProfileSummary[];
  busy: boolean;
  onCreated: (event: BirthGivingEventDetail | null) => void;
  onCancel: () => void;
}

function BirthGivingRetrospectiveTeamCreate({
  event,
  organizerProfiles,
  busy,
  onCreated,
  onCancel,
}: BirthGivingRetrospectiveTeamCreateProps) {
  const [name, setName] = useState("");
  const [memberProfileIds, setMemberProfileIds] = useState<string[]>([]);
  const [resultState, setResultState] = useState<BirthGivingTeamResultState>("present");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excludedIds = useMemo(() => otherTeamMemberProfileIds(event, ""), [event]);

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Název týmu je povinný");
      return;
    }
    if (memberProfileIds.length === 0) {
      setError("Vyberte alespoň jednu osobu do týmu");
      return;
    }
    setSaving(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/historical-teams`,
        {
          body: {
            name: trimmedName,
            memberProfileIds,
            resultState,
          },
        },
      );
      if (result.ok && result.body.data) {
        toast.success("Tým byl vytvořen");
        onCreated(result.body.data);
        return;
      }
      toast.error(result.body.error ?? "Tým se nepodařilo vytvořit");
      onCreated(result.body.data ?? null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3 p-3 sm:p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bg-historical-team-create-name">Název týmu</Label>
            <Input
              id="bg-historical-team-create-name"
              value={name}
              disabled={busy || saving}
              onChange={(changeEvent) => setName(changeEvent.target.value)}
              placeholder="Např. Tým Alfa"
            />
          </div>
          <div className="space-y-2">
            <Label>Stav výsledku</Label>
            <Select
              value={resultState}
              onValueChange={(value) => setResultState(value as BirthGivingTeamResultState)}
              disabled={busy || saving}
            >
              <SelectTrigger aria-label="Stav výsledku">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Soubory s výsledky</SelectItem>
                <SelectItem value="missing">Výsledek nedohledán</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <BirthGivingProfilePicker
          profiles={organizerProfiles}
          selected={memberProfileIds}
          onChange={setMemberProfileIds}
          label="Člen:ky týmu"
          placeholder="Vyberte osoby"
          excludeIds={excludedIds}
          disabled={busy || saving}
        />

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy || saving} onClick={onCancel}>
            Zrušit
          </Button>
          <Button type="submit" disabled={busy || saving}>
            {(busy || saving) && (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            )}
            Vytvořit tým
          </Button>
        </div>
      </form>
    </Card>
  );
}