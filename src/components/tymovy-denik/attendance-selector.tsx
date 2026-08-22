"use client"

import { Check, UserX, Clock, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ProfileAvatar } from "@/components/profile-avatar"
import type { TeamMemberProfile, AttendanceStatus } from "@/lib/tymovy-denik/types"
import type { TeamActivityAttendeeInput } from "@/app/api/tymovy-denik/activities/_shared"
import { cn } from "@/lib/utils"

interface AttendanceSelectorProps {
  teamMembers: TeamMemberProfile[]
  value: TeamActivityAttendeeInput[]
  onChange: (value: TeamActivityAttendeeInput[]) => void
  disabled?: boolean
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; icon: typeof Check; chipClass: string; activeBg: string }
> = {
  present: {
    label: "Účast",
    icon: Check,
    chipClass: "border-success/30 bg-success/10 text-success-strong",
    activeBg: "bg-success/20 text-success-strong border-success/40",
  },
  excused: {
    label: "Omluven:a",
    icon: Clock,
    chipClass: "border-warning/30 bg-warning/10 text-warning-strong",
    activeBg: "bg-warning/20 text-warning-strong border-warning/40",
  },
  absent: {
    label: "Neúčast",
    icon: UserX,
    chipClass: "border-border/50 bg-muted/60 text-muted-foreground",
    activeBg: "bg-muted text-foreground border-border",
  },
  late: {
    label: "Zpoždění",
    icon: Clock,
    chipClass: "border-chart-3/30 bg-chart-3/10 text-chart-3-strong",
    activeBg: "bg-chart-3/20 text-chart-3-strong border-chart-3/40",
  },
}

export function AttendanceSelector({
  teamMembers,
  value,
  onChange,
  disabled = false,
}: AttendanceSelectorProps) {
  const statusMap = new Map<string, AttendanceStatus>(
    value.map((a) => [a.profileId, a.status]),
  )

  const presentCount = teamMembers.filter(
    (m) => (statusMap.get(m.id) ?? "absent") === "present",
  ).length

  function setMemberStatus(profileId: string, status: AttendanceStatus) {
    if (disabled) return
    const updated = value.filter((a) => a.profileId !== profileId)
    if (status !== "absent") {
      updated.push({ profileId, status })
    }
    onChange(updated)
  }

  function handleToggleMember(profileId: string) {
    if (disabled) return
    const current = statusMap.get(profileId) ?? "absent"
    // Cycle: present -> excused -> absent -> present
    const nextStatus: AttendanceStatus =
      current === "present"
        ? "excused"
        : current === "excused"
          ? "absent"
          : "present"
    setMemberStatus(profileId, nextStatus)
  }

  function handleSelectAll() {
    if (disabled) return
    onChange(teamMembers.map((m) => ({ profileId: m.id, status: "present" })))
  }

  function handleDeselectAll() {
    if (disabled) return
    onChange([])
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/50 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <Label className="font-medium text-sm">Účast týmu</Label>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {presentCount} z {teamMembers.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleSelectAll}
            disabled={disabled || presentCount === teamMembers.length}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Všichni
          </Button>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleDeselectAll}
            disabled={disabled || value.length === 0}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Zrušit
          </Button>
        </div>
      </div>

      {teamMembers.length === 0 ? (
        <p className="text-xs text-muted-foreground">V týmu zatím nejsou další členové:ky.</p>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {teamMembers.map((member) => {
            const currentStatus: AttendanceStatus = statusMap.get(member.id) ?? "absent"
            const config = STATUS_CONFIG[currentStatus]
            const StatusIcon = config.icon
            const isPresent = currentStatus === "present"
            const isExcused = currentStatus === "excused"

            return (
              <div
                key={member.id}
                onClick={() => handleToggleMember(member.id)}
                className={cn(
                  "group flex cursor-pointer items-center justify-between gap-2 rounded-lg border p-2 text-sm transition-all select-none",
                  isPresent && "border-success/30 bg-success/5 hover:bg-success/10",
                  isExcused && "border-warning/30 bg-warning/5 hover:bg-warning/10",
                  currentStatus === "absent" && "border-border/40 bg-background/50 opacity-70 hover:opacity-100 hover:bg-accent/40",
                  disabled && "pointer-events-none opacity-50",
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ProfileAvatar picture={member.picture} name={member.name} size={26} />
                  <span className="truncate text-xs font-medium sm:text-sm">
                    {member.name ?? "Bez jména"}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title={`Změnit stav (${config.label})`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                      config.chipClass,
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleMember(member.id)
                    }}
                  >
                    <StatusIcon className="size-3" />
                    <span>{config.label}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
