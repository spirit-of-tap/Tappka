"use client"

import { useState } from "react"
import { Plus, Trash2, Users, CheckSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ProfileAvatar } from "@/components/profile-avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TeamMemberProfile } from "@/lib/tymovy-denik/types"
import type { ActionStepItem } from "@/lib/tymova-reflexe/action-steps"

interface ActionStepsEditorProps {
  steps: ActionStepItem[]
  onChange: (steps: ActionStepItem[]) => void
  teamMembers?: TeamMemberProfile[]
}

const CUSTOM_ASSIGNEE_KEY = "__custom__"

export function ActionStepsEditor({
  steps,
  onChange,
  teamMembers = [],
}: ActionStepsEditorProps) {
  const [customModeSteps, setCustomModeSteps] = useState<Record<string, boolean>>({})
  const [editingAssigneeStepIds, setEditingAssigneeStepIds] = useState<Record<string, boolean>>({})

  function handleAdd() {
    const newStep: ActionStepItem = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: "",
      assignee: "",
    }
    setEditingAssigneeStepIds((prev) => ({ ...prev, [newStep.id]: true }))
    onChange([...steps, newStep])
  }

  function handleRemove(id: string) {
    onChange(steps.filter((s) => s.id !== id))
  }

  function handleTextChange(id: string, text: string) {
    onChange(steps.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  function handleAssigneeChange(id: string, assignee: string) {
    setEditingAssigneeStepIds((prev) => ({ ...prev, [id]: false }))
    onChange(steps.map((s) => (s.id === id ? { ...s, assignee } : s)))
  }

  function toggleCustomMode(id: string, custom: boolean) {
    setCustomModeSteps((prev) => ({ ...prev, [id]: custom }))
    setEditingAssigneeStepIds((prev) => ({ ...prev, [id]: true }))
  }

  function startEditingAssignee(id: string) {
    setEditingAssigneeStepIds((prev) => ({ ...prev, [id]: true }))
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="space-y-1.5 pb-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <CheckSquare className="size-4" />
            </div>
            <h3 className="font-heading text-base font-semibold text-foreground truncate">
              Plánované akční kroky
            </h3>
            <Badge variant="secondary" className="text-xs px-2 py-0 h-5 font-medium shrink-0">
              {steps.length}
            </Badge>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="shrink-0 h-8 gap-1.5"
          >
            <Plus className="size-3.5" />
            Přidat krok
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/75 italic">
          „Když je zodpovědný každý, ve skutečnosti není zodpovědný nikdo.“ — Albert Bandura
        </p>
      </div>

      {/* Flat List of Steps */}
      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            Zatím nejsou naplánovány žádné akční kroky.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="mt-2 text-xs text-primary"
          >
            <Plus className="size-3.5" />
            Vytvořit první akční krok
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {steps.map((step, index) => {
            const hasAssignee = Boolean(step.assignee && step.assignee.trim().length > 0)
            const isEditingAssignee = editingAssigneeStepIds[step.id] || !hasAssignee
            const matchedMember = teamMembers.find((m) => m.name === step.assignee)
            const isCustom =
              customModeSteps[step.id] ||
              (hasAssignee && !matchedMember)

            return (
              <div
                key={step.id}
                className="group/row flex items-start gap-3 py-2.5 first:pt-1 last:pb-1 transition-colors"
              >
                {/* Index Pill */}
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                  {index + 1}
                </span>

                {/* Content */}
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Textarea
                    aria-label="Plánovaný akční krok"
                    value={step.text}
                    onChange={(e) => handleTextChange(step.id, e.target.value)}
                    placeholder="Co konkrétně uděláme (akční krok)…"
                    rows={1}
                    className="w-full resize-none text-sm border-0 bg-transparent p-1 min-h-[32px] shadow-none focus-visible:ring-0 focus-visible:bg-muted/20 rounded transition-colors placeholder:text-muted-foreground/60 leading-normal"
                  />

                  <div className="flex items-center gap-2 flex-wrap pl-1">
                    <span className="text-[11px] font-medium text-muted-foreground/75 shrink-0">
                      Zodpovědnost:
                    </span>

                    {/* Selected Human Mode (Read-only pill with "Změnit" button) */}
                    {!isEditingAssignee && hasAssignee ? (
                      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2 py-0.5 text-xs text-foreground">
                        {matchedMember ? (
                          <ProfileAvatar
                            name={matchedMember.name}
                            picture={matchedMember.picture}
                            size={16}
                            className="size-4 shrink-0"
                          />
                        ) : (
                          <Users className="size-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium truncate max-w-[200px]">{step.assignee}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingAssignee(step.id)}
                          className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/10 ml-0.5 font-normal"
                        >
                          Změnit
                        </Button>
                      </div>
                    ) : isCustom || teamMembers.length === 0 ? (
                      /* Custom Name Input Mode */
                      <div className="flex items-center gap-1.5 flex-1 min-w-[180px] max-w-xs">
                        <Input
                          aria-label="Zodpovědná osoba za AK"
                          value={step.assignee}
                          onChange={(e) => {
                            const val = e.target.value
                            onChange(steps.map((s) => (s.id === step.id ? { ...s, assignee: val } : s)))
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleAssigneeChange(step.id, step.assignee)
                            }
                          }}
                          placeholder="Jméno zodpovědné osoby / lídra:kyně"
                          className="h-7 text-xs bg-muted/20 border-border/40 focus:bg-background"
                          autoFocus={hasAssignee}
                        />
                        {hasAssignee && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAssigneeChange(step.id, step.assignee)}
                            className="h-7 px-2 text-xs text-primary hover:text-primary/80"
                          >
                            Hotovo
                          </Button>
                        )}
                        {teamMembers.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCustomMode(step.id, false)}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            title="Vybrat ze seznamu členů týmu"
                          >
                            <Users className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      /* Dropdown Selection Mode */
                      <div className="flex items-center gap-1.5 flex-1 min-w-[180px] max-w-xs">
                        <Select
                          value={step.assignee || undefined}
                          onValueChange={(val) => {
                            if (val === CUSTOM_ASSIGNEE_KEY) {
                              toggleCustomMode(step.id, true)
                            } else {
                              handleAssigneeChange(step.id, val)
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/40 hover:bg-muted/30">
                            <SelectValue placeholder="Vyberte člena:ku týmu" />
                          </SelectTrigger>
                          <SelectContent>
                            {teamMembers.map((member) => (
                              <SelectItem key={member.id} value={member.name ?? ""}>
                                <div className="flex items-center gap-2">
                                  <ProfileAvatar
                                    name={member.name}
                                    picture={member.picture}
                                    size={16}
                                    className="size-4"
                                  />
                                  <span>{member.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_ASSIGNEE_KEY}>
                              <span className="text-muted-foreground italic">
                                Jiné jméno / skupina…
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(step.id)}
                  className="size-7 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0 mt-0.5"
                  aria-label="Smazat akční krok"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
