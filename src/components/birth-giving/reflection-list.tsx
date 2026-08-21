"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BirthGivingReflectionForm } from "./reflection-form";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import type {
  BirthGivingEventDetail,
  BirthGivingMemberWithProfile,
  BirthGivingReflection,
  BirthGivingTeamDetail,
} from "@/lib/birth-giving/types";

interface BirthGivingReflectionListProps {
  event: BirthGivingEventDetail;
  team: BirthGivingTeamDetail;
  profileId: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

interface ReflectionEditorState {
  member: BirthGivingMemberWithProfile;
  reflection: BirthGivingReflection | null;
}

export function BirthGivingReflectionList({
  event,
  team,
  profileId,
  onEventChange,
}: BirthGivingReflectionListProps) {
  const [editor, setEditor] = useState<ReflectionEditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const myMembership = team.members.find(({ profile_id }) => profile_id === profileId);
  const reflections = team.members.filter((member) => member.reflection !== null);

  async function save(values: { contribution: string; learning: string }) {
    if (!myMembership || !editor) return;
    setBusy(true);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/reflection`,
        { method: "PUT", body: values },
      );
      if (result.ok && result.body.data) {
        toast.success("Reflexe byla uložena");
        setEditor(null);
        onEventChange(result.body.data);
        return;
      }
      toast.error(result.body.error ?? "Reflexi se nepodařilo uložit");
      onEventChange(result.body.data ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {reflections.length === 0 && (
        <Empty className="gap-3 p-4 md:p-4">
          <EmptyMedia variant="icon">
            <MessageSquarePlus className="size-5" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle className="text-sm">Zatím žádné reflexe</EmptyTitle>
            <EmptyDescription className="text-xs">
              Každý člen:ka týmu může přidat svou osobní reflexi.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      <ul className="space-y-2">
        {reflections.map((member) => {
          const reflection = member.reflection;
          if (!reflection) return null;
          return (
            <li key={reflection.id} className="space-y-1.5 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <ProfileAvatar picture={member.profile.picture} name={member.profile.name} size={22} />
                <span className="text-sm font-medium">{member.profile.name}</span>
              </div>
              <div className="text-xs">
                <p><span className="text-muted-foreground">Přínos: </span>{reflection.contribution}</p>
                <p><span className="text-muted-foreground">Poučení: </span>{reflection.learning}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {myMembership && !editor && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setEditor({ member: myMembership, reflection: myMembership.reflection })}
        >
          <MessageSquarePlus className="size-4" />
          {myMembership.reflection ? "Upravit reflexi" : "Přidat reflexi"}
        </Button>
      )}

      <Dialog open={editor !== null} onOpenChange={(open) => { if (!open) setEditor(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editor?.reflection ? "Upravit reflexi" : "Nová reflexe"}</DialogTitle>
            <DialogDescription>
              Popište svůj přínos v týmu a co si z práce odnášíte.
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <BirthGivingReflectionForm
              initial={editor.reflection ?? undefined}
              onSubmit={(values) => void save(values)}
              onCancel={() => setEditor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}