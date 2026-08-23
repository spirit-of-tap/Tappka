"use client"

import { useState } from "react"
import { Plus, Trash2, User, Users, Quote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

  function handleAdd() {
    const newStep: ActionStepItem = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: "",
      assignee: "",
    }
    onChange([...steps, newStep])
  }

  function handleRemove(id: string) {
    onChange(steps.filter((s) => s.id !== id))
  }

  function handleTextChange(id: string, text: string) {
    onChange(steps.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  function handleAssigneeChange(id: string, assignee: string) {
    onChange(steps.map((s) => (s.id === id ? { ...s, assignee } : s)))
  }

  function toggleCustomMode(id: string, custom: boolean) {
    setCustomModeSteps((prev) => ({ ...prev, [id]: custom }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Plánované akční kroky</h3>
          <p className="text-xs text-muted-foreground">
            Konkrétní kroky a zodpovědné osoby pro další období
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="size-4" />
          Přidat krok
        </Button>
      </div>

      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Zatím nejsou naplánovány žádné akční kroky.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="mt-2 text-xs"
          >
            <Plus className="size-3.5" />
            Vytvořit první akční krok
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => {
            const isCustom =
              customModeSteps[step.id] ||
              (step.assignee && !teamMembers.some((m) => m.name === step.assignee))

            return (
              <div
                key={step.id}
                className="group relative flex flex-col sm:flex-row items-start gap-3 rounded-lg border border-border bg-card p-3 sm:p-4 transition-colors"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>

                <div className="flex-1 space-y-2 w-full">
                  <Textarea
                    value={step.text}
                    onChange={(e) => handleTextChange(step.id, e.target.value)}
                    placeholder="Co konkrétně uděláme (akční krok)…"
                    rows={2}
                    className="resize-none text-sm"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      Zodpovědnost:
                    </span>

                    {isCustom || teamMembers.length === 0 ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                        <Input
                          value={step.assignee}
                          onChange={(e) => handleAssigneeChange(step.id, e.target.value)}
                          placeholder="Jméno zodpovědné osoby nebo lídra:kyně"
                          className="h-8 text-xs"
                        />
                        {teamMembers.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCustomMode(step.id, false)}
                            className="h-8 px-2 text-xs"
                            title="Vybrat ze seznamu týmu"
                          >
                            <Users className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
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
                          <SelectTrigger className="h-8 text-xs">
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

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(step.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive self-end sm:self-center"
                  aria-label="Smazat akční krok"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Note & Bandura Quote */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <Quote className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
        <div className="space-y-1">
          <p className="font-medium italic text-foreground/90">
            „Když je zodpovědný každý, ve skutečnosti není zodpovědný nikdo.“
            <span className="font-normal not-italic text-muted-foreground"> — Albert Bandura</span>
          </p>
          <p>
            Pokud má akční krok na starosti celá skupinka, vždy určete jednoho:jednu vedoucí:ho (lídra:kyni),
            který:která má za dotažení hlavní zodpovědnost.
          </p>
        </div>
      </div>
    </div>
  )
}
