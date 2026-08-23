"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Pencil,
  Trash2,
  Ellipsis,
  Calendar,
  Target,
  Lightbulb,
  Users,
  CheckCircle2,
  Clock,
  UserX,
  Maximize2,
  Sparkles,
  Camera,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/responsive-dialog"
import { ProfileAvatar } from "@/components/profile-avatar"
import { toast } from "sonner"

import { TeamActivityForm } from "./team-activity-form"
import { TeamActivityImage } from "./team-activity-image"
import { getTeamActivityLoop } from "@/lib/tymovy-denik/status"
import { formatActivityDate } from "@/lib/tymovy-denik/format"
import { getTransformedImageUrl } from "@/lib/storage/public-url"
import type { TeamActivityWithCreator, TeamMemberProfile, AttendanceStatus } from "@/lib/tymovy-denik/types"

interface TeamActivityDetailProps {
  activity: TeamActivityWithCreator
  teamMembers?: TeamMemberProfile[]
}

interface DeleteActivityResponse {
  error?: string
}

export function TeamActivityDetail({ activity, teamMembers = [] }: TeamActivityDetailProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loop = getTeamActivityLoop(activity)

  // Categorize attendance across all team members
  const attendeeStatusMap = new Map<string, AttendanceStatus>(
    activity.attendees?.map((a) => [a.profile_id, a.status]) ?? []
  )

  const allKnownMembers: TeamMemberProfile[] = [...teamMembers]
  for (const att of activity.attendees ?? []) {
    if (att.profile && !allKnownMembers.some((m) => m.id === att.profile_id)) {
      allKnownMembers.push(att.profile)
    }
  }

  const hasRecordedAttendees = (activity.attendees?.length ?? 0) > 0
  const presentMembers = hasRecordedAttendees
    ? allKnownMembers.filter((m) => attendeeStatusMap.get(m.id) === "present")
    : []
  const excusedMembers = hasRecordedAttendees
    ? allKnownMembers.filter((m) => attendeeStatusMap.get(m.id) === "excused")
    : []
  const absentMembers = hasRecordedAttendees
    ? allKnownMembers.filter((m) => {
        const st = attendeeStatusMap.get(m.id)
        return st === "absent" || st === undefined
      })
    : []

  async function handleDelete() {
    setDeleting(true)
    try {
      const response = await fetch(`/api/tymovy-denik/activities/${activity.id}`, {
        body: JSON.stringify({ expectedUpdatedAt: activity.updated_at }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      })
      const body = await response.json().catch(() => null) as DeleteActivityResponse | null
      if (!response.ok) {
        throw new Error(body?.error ?? "Nepodařilo se odstranit akci")
      }

      toast.success("Akce odstraněna")
      router.push("/tymovy-denik")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nepodařilo se odstranit akci")
    } finally {
      setDeleting(false)
    }
  }

  function handleUpdated(_: TeamActivityWithCreator) {
    setEditOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Editorial Photo Showcase / Hero */}
      {activity.image_path ? (
        <div className="relative group overflow-hidden rounded-2xl border border-border/60 bg-muted shadow-sm">
          <div
            onClick={() => setLightboxOpen(true)}
            className="cursor-zoom-in overflow-hidden aspect-[16/9] sm:aspect-[21/9]"
          >
            <TeamActivityImage
              imagePath={activity.image_path}
              variant="hero"
              priority
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>

          {/* Lightbox hint overlay button */}
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs transition-opacity opacity-80 hover:opacity-100"
            aria-label="Zvětšit fotografii"
          >
            <Maximize2 className="size-3.5" />
            <span>Zvětšit</span>
          </button>

          {loop && (
            <Badge
              variant="outline"
              className="absolute left-3 top-3 border-transparent bg-warning/90 text-warning-strong backdrop-blur-xs font-medium shadow-xs"
            >
              Chybí reflexe
            </Badge>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 sm:p-6">
          <div className="flex items-center gap-3.5">
            <div className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">Záznam bez fotografie</p>
              <p className="text-xs text-muted-foreground">
                Fotografie uchovává společné týmové vzpomínky.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-1.5 text-xs"
          >
            <Camera className="size-3.5" />
            Přidat fotku
          </Button>
        </div>
      )}

      {/* Main Header & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
              {activity.activity_type}
            </h1>
            {!activity.image_path && loop && (
              <Badge variant="outline" className="border-transparent bg-warning/10 text-warning-strong font-medium">
                Chybí reflexe
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 text-muted-foreground/70" />
              {formatActivityDate(activity.occurred_at)}
            </span>
            {activity.created_by && (
              <span className="inline-flex items-center gap-1.5">
                <ProfileAvatar
                  picture={activity.created_by.picture}
                  name={activity.created_by.name}
                  size={18}
                />
                <span>Zaznamenal:a {activity.created_by.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="size-4" />
            Upravit
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                aria-label="Další akce"
              >
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault()
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="size-4" />
                Smazat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Actionable Open Loop Prompt: Missing Reflection */}
      {loop && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-warning-strong">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs sm:text-sm">
              <p className="font-semibold">K této akci zatím chybí týmová reflexe</p>
              <p className="text-warning-strong/85">
                Doplňte, co jste si jako tým odnesli a co jste se naučili, ať je záznam kompletní pro portfolio.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
            className="shrink-0 border-warning/40 bg-warning/20 text-warning-strong hover:bg-warning/30"
          >
            Doplnit reflexi
          </Button>
        </div>
      )}

      {/* Story Sections Grid */}
      <div className="grid grid-cols-1 gap-6">
        {/* Purpose / Reason */}
        {activity.reason && (
          <Card className="border-border/60 bg-card/60">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Target className="size-4 text-primary" />
                <span>Proč jsme tam byli (Cíl & Účel)</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {activity.reason}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reflection / Takeaways (Highlighted Hero Section) */}
        {activity.reflection && (
          <Card className="border-primary/20 bg-primary/5 shadow-2xs">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                <Lightbulb className="size-4 text-amber-500" />
                <span>Co jsme si odnesli (Týmová reflexe & Poučení)</span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-foreground font-medium">
                {activity.reflection}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Team Attendance Section */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Users className="size-4 text-muted-foreground/70" />
                <span>Účast týmu</span>
              </div>
              {hasRecordedAttendees && (
                <span className="text-xs text-muted-foreground">
                  <span className="text-success-strong font-medium">{presentMembers.length}</span>
                  {" z "}
                  <span className="font-medium text-foreground">{allKnownMembers.length}</span>
                  {" přítomno:na"}
                  {excusedMembers.length > 0 && ` · ${excusedMembers.length} omluveno`}
                  {absentMembers.length > 0 && ` · ${absentMembers.length} neúčast`}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasRecordedAttendees ? (
              <div className="space-y-3">
                {/* Present members */}
                {presentMembers.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-success-strong">
                      <CheckCircle2 className="size-3.5" />
                      <span>Účast ({presentMembers.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {presentMembers.map((member) => (
                        <div
                          key={member.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-2.5 py-1.5 text-xs font-medium text-foreground"
                        >
                          <ProfileAvatar
                            picture={member.picture}
                            name={member.name}
                            size={20}
                          />
                          <span>{member.name ?? "Člen:ka týmu"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Excused members */}
                {excusedMembers.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-warning-strong">
                      <Clock className="size-3.5" />
                      <span>Omluven:a ({excusedMembers.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {excusedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          <ProfileAvatar
                            picture={member.picture}
                            name={member.name}
                            size={20}
                          />
                          <span>{member.name ?? "Člen:ka týmu"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Absent members (did not attend at all) */}
                {absentMembers.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <UserX className="size-3.5" />
                      <span>Neúčast ({absentMembers.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {absentMembers.map((member) => (
                        <div
                          key={member.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground opacity-75 hover:opacity-100 transition-opacity"
                        >
                          <ProfileAvatar
                            picture={member.picture}
                            name={member.name}
                            size={20}
                          />
                          <span>{member.name ?? "Člen:ka týmu"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Účast nebyla specifikována.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upravit akci</DialogTitle>
          </DialogHeader>
          <TeamActivityForm
            initial={activity}
            teamMembers={teamMembers}
            onSuccess={handleUpdated}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Lightbox / Zoom Dialog */}
      {activity.image_path && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="sm:max-w-5xl max-h-[95vh] p-2 bg-black/95 border-neutral-800 text-white">
            <DialogHeader className="sr-only">
              <DialogTitle>{activity.activity_type}</DialogTitle>
            </DialogHeader>
            <div className="relative flex flex-col items-center justify-center p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getTransformedImageUrl("images", activity.image_path, {
                  quality: 90,
                  resize: "contain",
                })}
                alt={activity.activity_type}
                className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
              />
              <p className="mt-2 text-center text-xs text-neutral-400">
                {activity.activity_type} · {formatActivityDate(activity.occurred_at)}
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstranit akci?</AlertDialogTitle>
            <AlertDialogDescription>
              Tímto odeberete {activity.activity_type} ({formatActivityDate(activity.occurred_at)})
              z deníku.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? "Odstraňuji..." : "Odstranit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
