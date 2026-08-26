"use client";

import { useState } from "react";
import { Loader2, Plus, Trophy, Users } from "lucide-react";
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
import { BirthGivingProfilePicker } from "@/components/birth-giving/profile-picker";
import { BirthGivingResultFileList } from "@/components/birth-giving/result-file-list";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import type {
  BirthGivingEventDetail,
  BirthGivingProfileSummary,
  BirthGivingTeamDetail,
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
  const teams = event.teams.filter(({ cancelled_at }) => !cancelled_at);

  function refreshAfterMutation(updated: BirthGivingEventDetail | null) {
    onEventChange(updated);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Vytvořte týmy, vyberte jejich členy:ky a nahrajte soubory s výsledky.
        Můžete také označit vítězný tým.
      </p>

      {teams.length === 0 && (
        <Empty className="border-dashed">
          <EmptyMedia variant="icon">
            <Users className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">Zatím nejsou vytvořené žádné týmy.</EmptyTitle>
            <EmptyDescription className="text-xs">
              Přidejte první tým, abyste mohli událost dokončit.
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
          onCreated={(updated) => {
            setAdding(false);
            refreshAfterMutation(updated);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
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
    .filter(({ id, cancelled_at }) => id !== teamId && !cancelled_at)
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

  async function patchTeam(changes: {
    name?: string;
    memberProfileIds?: string[];
    isWinner?: boolean;
  }) {
    setSaving(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/teams/${team.id}`,
        {
          method: "PATCH",
          body: {
            name: changes.name ?? (name.trim() || team.name),
            memberProfileIds: changes.memberProfileIds ?? memberProfileIds,
            isWinner: changes.isWinner !== undefined ? changes.isWinner : team.is_winner,
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
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{team.name}</h3>
          {team.is_winner && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
              <Trophy className="size-3" />
              Vítěz
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant={team.is_winner ? "secondary" : "outline"}
          size="xs"
          disabled={saving}
          onClick={() => void patchTeam({ isWinner: !team.is_winner })}
        >
          <Trophy className="size-3 mr-1" />
          {team.is_winner ? "Zrušit vítěze" : "Označit za vítěze"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`bg-team-name-${team.id}`}>Název týmu</Label>
          <Input
            id={`bg-team-name-${team.id}`}
            value={name}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
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
            label="Členové:ky týmu"
            placeholder="Vyberte osoby"
            excludeIds={otherTeamMemberIds}
            disabled={saving}
          />
        </div>
      </div>

      <div className="pt-2">
        <BirthGivingResultFileList
          event={event}
          team={team}
          profileId={profileId}
          now={now}
          disabled={saving}
          onEventChange={onEventChange}
        />
      </div>
    </Card>
  );
}

interface BirthGivingRetrospectiveTeamCreateProps {
  event: BirthGivingEventDetail;
  organizerProfiles: BirthGivingProfileSummary[];
  onCreated: (event: BirthGivingEventDetail) => void;
  onCancel: () => void;
}

function BirthGivingRetrospectiveTeamCreate({
  event,
  organizerProfiles,
  onCreated,
  onCancel,
}: BirthGivingRetrospectiveTeamCreateProps) {
  const [name, setName] = useState("");
  const [memberProfileIds, setMemberProfileIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingMemberIds = event.teams
    .filter(({ cancelled_at }) => !cancelled_at)
    .flatMap(({ members }) => members.map(({ profile_id }) => profile_id));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Název týmu je povinný");
      return;
    }
    setSaving(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/teams`,
        {
          method: "POST",
          body: {
            name: trimmed,
            memberProfileIds,
          },
        },
      );
      if (result.ok && result.body.data) {
        toast.success("Tým byl přidán");
        onCreated(result.body.data);
        return;
      }
      toast.error(result.body.error ?? "Tým se nepodařilo vytvořit");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4 p-3 sm:p-4 border-primary/40">
      <h3 className="text-sm font-semibold">Nový tým</h3>
      <form onSubmit={handleCreate} className="space-y-4">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="bg-new-retro-team-name">Název týmu</Label>
            <Input
              id="bg-new-retro-team-name"
              value={name}
              disabled={saving}
              onChange={(e) => setName(e.target.value)}
              placeholder="Např. Tým Alfa"
            />
          </div>
          <div className="space-y-2">
            <BirthGivingProfilePicker
              profiles={organizerProfiles}
              selected={memberProfileIds}
              onChange={setMemberProfileIds}
              label="Členové:ky týmu"
              placeholder="Vyberte osoby"
              excludeIds={existingMemberIds}
              disabled={saving}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Zrušit
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
            Přidat tým
          </Button>
        </div>
      </form>
    </Card>
  );
}