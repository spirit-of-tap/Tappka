"use client"

import { useState } from "react"
import { Plus, Trash2, Users, Quote, CheckSquare, Sparkles } from "lucide-react"
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <CheckSquare className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-base font-semibold text-foreground">
                Plánované akční kroky
              </h3>
              <Badge variant="secondary" className="text-xs px-2 py-0 h-5 font-medium">
                {steps.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Konkrétní kroky s přiřazenou zodpovědnou osobou pro další období
            </p>
          </div>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={handleAdd} className="self-start sm:self-auto">
          <Plus className="size-4" />
          Přidat krok
        </Button>
      </div>

      {/* Quote Banner */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <Quote className="mt-0.5 size-4 shrink-0 text-primary/70" />
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">
            „Když je zodpovědný každý, ve skutečnosti není zodpovědný nikdo.“
            <span className="font-normal text-muted-foreground"> — Albert Bandura</span>
          </p>
          <p className="text-[11px]">
            Pokud má akční krok na starosti celá skupinka, vždy určete jednoho:jednu lídra:kyni zodpovědného:ou za dotažení.
          </p>
        </div>
      </div>

      {/* Flat List of Steps (No Nested Cards) */}
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
        <div className="divide-y divide-border/50 rounded-lg border border-border/70 bg-card">
          {steps.map((step, index) => {
            const isCustom =
              customModeSteps[step.id] ||
              (step.assignee && !teamMembers.some((m) => m.name === step.assignee))

            return (
              <div
                key={step.id}
                className="group/row flex items-start gap-3 p-3 sm:p-4 transition-colors hover:bg-muted/10"
              >
                {/* Index Pill */}
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-1">
                  {index + 1}
                </span>

                {/* Content */}
                <div className="flex-1 space-y-2 min-w-0">
                  <Textarea
                    value={step.text}
                    onChange={(e) => handleTextChange(step.id, e.target.value)}
                    placeholder="Co konkrétně uděláme (akční krok)…"
                    rows={2}
                    className="min-h-[52px] resize-none text-sm bg-muted/20 border-border/50 focus:bg-background focus:border-primary/50 transition-colors"
                  />

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                      Zodpovědnost:
                    </span>

                    {isCustom || teamMembers.length === 0 ? (
                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px] max-w-sm">
                        <Input
                          value={step.assignee}
                          onChange={(e) => handleAssigneeChange(step.id, e.target.value)}
                          placeholder="Jméno zodpovědné osoby / lídra:kyně"
                          className="h-7 text-xs bg-muted/20 border-border/50 focus:bg-background"
                        />
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
                      <div className="flex items-center gap-1.5 flex-1 min-w-[200px] max-w-sm">
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
                          <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/50 hover:bg-muted/30">
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
                  className="size-7 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 shrink-0 mt-0.5"
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
