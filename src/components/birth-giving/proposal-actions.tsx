"use client";

import { useState } from "react";
import { Loader2, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { BirthGivingProfilePicker } from "./profile-picker";
import { birthGivingMutationRequest } from "@/lib/birth-giving/mutation";
import {
  canFormBirthGivingTeams,
  getBirthGivingMembership,
  isBirthGivingTeamMember,
} from "@/lib/birth-giving/permissions";
import type { BirthGivingEventDetail, BirthGivingProfileSummary, BirthGivingTeamDetail, BirthGivingTeamProposal } from "@/lib/birth-giving/types";

interface BirthGivingProposalActionsProps {
  event: BirthGivingEventDetail;
  team: BirthGivingTeamDetail;
  profileId: string;
  profiles: BirthGivingProfileSummary[];
  now: string;
  onEventChange: (event: BirthGivingEventDetail | null) => void;
}

interface PendingMoveAcknowledgement {
  direction: "join_request" | "invitation";
  candidateProfileId: string;
}

export function BirthGivingProposalActions({
  event,
  team,
  profileId,
  profiles,
  now,
  onEventChange,
}: BirthGivingProposalActionsProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMoveAcknowledgement | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitedProfileIds, setInvitedProfileIds] = useState<string[]>([]);

  const isMember = isBirthGivingTeamMember(team, profileId);
  const myTeamId = getBirthGivingMembership(event, profileId)?.team_id ?? null;
  const formationOpen = canFormBirthGivingTeams(event, new Date(now));

  const myPendingJoin = team.proposals.some(
    (proposal) =>
      proposal.direction === "join_request"
      && proposal.candidate_profile_id === profileId,
  );
  const myPendingInvitation = team.proposals.some(
    (proposal) =>
      proposal.direction === "invitation"
      && proposal.candidate_profile_id === profileId,
  );

  async function resolveProposal(proposal: BirthGivingTeamProposal, action: "accept" | "reject" | "cancel") {
    setBusyId(`${proposal.id}-${action}`);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/proposals/${proposal.id}/${action}`,
      );
      if (result.ok && result.body.data) {
        if (action === "accept") {
          toast.success(
            proposal.direction === "invitation"
              ? "Pozvánka byla přijata"
              : "Žádost byla přijata",
          );
        } else if (action === "reject") {
          toast.success("Návrh byl odmítnut");
        } else {
          toast.success("Návrh byl zrušen");
        }
        onEventChange(result.body.data);
        return;
      }
      toast.error(result.body.error ?? "Akci se nepodařilo dokončit");
      onEventChange(result.body.data ?? null);
    } finally {
      setBusyId(null);
    }
  }

  async function createProposal(
    direction: "join_request" | "invitation",
    candidateProfileId: string,
    acknowledgeMove: boolean,
  ) {
    setBusyId(`create-${candidateProfileId}`);
    try {
      const result = await birthGivingMutationRequest(
        `/api/birth-giving/events/${event.id}/proposals`,
        {
          body: {
            teamId: team.id,
            candidateProfileId,
            direction,
            acknowledgeMove,
          },
        },
      );
      if (result.body.code === "MOVE_REQUIRES_ACKNOWLEDGEMENT") {
        setPendingMove({ direction, candidateProfileId });
        return;
      }
      if (result.ok && result.body.data) {
        if (direction === "invitation") toast.success("Pozvánka byla odeslána");
        else toast.success("Žádost o vstup byla odeslána");
        onEventChange(result.body.data);
        setInviteOpen(false);
        setInvitedProfileIds([]);
        return;
      }
      toast.error(result.body.error ?? "Návrh se nepodařilo vytvořit");
      onEventChange(result.body.data ?? null);
    } finally {
      setBusyId(null);
    }
  }

  function confirmMove() {
    const move = pendingMove;
    setPendingMove(null);
    if (!move) return;
    void createProposal(move.direction, move.candidateProfileId, true);
  }

  const teamMemberIds = team.members.map(({ profile_id }) => profile_id);

  return (
    <div className="space-y-2">
      {team.proposals.map((proposal) => {
        const isOwnRequest = proposal.direction === "join_request"
          && proposal.candidate_profile_id === profileId;
        const isOwnInvitation = proposal.direction === "invitation"
          && proposal.initiated_by_profile_id === profileId;
        const isInvitedMe = proposal.direction === "invitation"
          && proposal.candidate_profile_id === profileId;
        const busy = busyId !== null;

        return (
          <div
            key={proposal.id}
            className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-xs"
          >
            <ProfileAvatar
              picture={proposal.candidate.picture}
              name={proposal.candidate.name}
              size={20}
            />
            <span className="min-w-0 flex-1">
              {proposal.direction === "invitation" && (
                <span className="font-medium">Pozvánka pro {proposal.candidate.name}</span>
              )}
              {proposal.direction === "join_request" && (
                <span className="font-medium">
                  {isOwnRequest ? "Tvoje žádost o vstup" : `Žádost o vstup od ${proposal.candidate.name}`}
                </span>
              )}
            </span>
            {isOwnInvitation && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => void resolveProposal(proposal, "cancel")}
              >
                {busyId === `${proposal.id}-cancel` && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />}
                Zrušit pozvánku
              </Button>
            )}
            {isOwnRequest && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={busy}
                onClick={() => void resolveProposal(proposal, "cancel")}
              >
                {busyId === `${proposal.id}-cancel` && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />}
                Zrušit žádost
              </Button>
            )}
            {isInvitedMe && (
              <>
                <Button
                  type="button"
                  size="xs"
                  disabled={busy}
                  onClick={() => void resolveProposal(proposal, "accept")}
                >
                  {busyId === `${proposal.id}-accept` && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />}
                  Přijmout pozvánku
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void resolveProposal(proposal, "reject")}
                >
                  {busyId === `${proposal.id}-reject` && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />}
                  Odmítnout pozvánku
                </Button>
              </>
            )}
            {!isOwnRequest && !isInvitedMe && !isOwnInvitation && proposal.direction === "join_request" && isMember && (
              <>
                <Button
                  type="button"
                  size="xs"
                  disabled={busy}
                  onClick={() => void resolveProposal(proposal, "accept")}
                >
                  {busyId === `${proposal.id}-accept` && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />}
                  Přijmout
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void resolveProposal(proposal, "reject")}
                >
                  {busyId === `${proposal.id}-reject` && <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />}
                  Odmítnout
                </Button>
              </>
            )}
          </div>
        );
      })}

      {formationOpen && isMember && (
        <Button type="button" size="sm" variant="outline" onClick={() => { setInvitedProfileIds([]); setInviteOpen(true); }}>
          <UserPlus className="size-4" />
          Pozvat
        </Button>
      )}

      {formationOpen && !isMember && !myPendingJoin && !myPendingInvitation && (
        <Button
          type="button"
          size="sm"
          disabled={busyId !== null}
          onClick={() => void createProposal("join_request", profileId, false)}
        >
          {busyId === `create-${profileId}` && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
          <Send className="size-4" />
          Požádat o vstup
        </Button>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pozvat osobu do týmu {team.name}</DialogTitle>
            <DialogDescription>
              Vyberte osobu, kterou chcete do týmu pozvat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <BirthGivingProfilePicker
              profiles={profiles}
              selected={invitedProfileIds}
              onChange={setInvitedProfileIds}
              label="Vybrat osobu pro pozvánku"
              placeholder="Najít podle jména"
              max={1}
              excludeIds={[...teamMemberIds, profileId]}
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Zrušit
              </Button>
              <Button
                type="button"
                disabled={invitedProfileIds.length !== 1 || busyId !== null}
                onClick={() => void createProposal("invitation", invitedProfileIds[0], false)}
              >
                {busyId === `create-${invitedProfileIds[0]}` && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
                Odeslat pozvánku
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingMove !== null} onOpenChange={(open) => { if (!open) setPendingMove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Přesun z existujícího týmu vyžaduje výslovné potvrzení.</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMove?.direction === "invitation"
                ? "Pozvaná osoba už je v jiném týmu. Přijetím pozvánky se přesune do tohoto týmu."
                : `${myTeamId ? "Zruší se tvé členství v aktuálním týmu" : "Připojíš se"} do týmu ${team.name}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline">Zrušit</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" onClick={confirmMove}>Pokračovat</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}