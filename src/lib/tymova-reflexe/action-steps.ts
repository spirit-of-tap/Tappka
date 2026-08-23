export interface ActionStepItem {
  id: string
  text: string
  assignee: string
}

export function parseActionSteps(
  rawSteps: string | null | undefined,
  rawResponsible: string | null | undefined,
): ActionStepItem[] {
  if (!rawSteps || !rawSteps.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(rawSteps)
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => ({
        id: typeof item.id === "string" && item.id ? item.id : `step-${index}-${Date.now()}`,
        text:
          typeof item.text === "string"
            ? item.text
            : typeof item.description === "string"
              ? item.description
              : "",
        assignee: typeof item.assignee === "string" ? item.assignee : (rawResponsible ?? ""),
      }))
    }
  } catch {
    // Legacy plain text format
  }

  const lines = rawSteps
    .split("\n")
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean)

  if (lines.length > 0) {
    return lines.map((line, index) => ({
      id: `legacy-${index}`,
      text: line,
      assignee: rawResponsible ?? "",
    }))
  }

  return [
    {
      id: "initial-1",
      text: rawSteps.trim(),
      assignee: rawResponsible ?? "",
    },
  ]
}

export function serializeActionSteps(steps: ActionStepItem[]): {
  planned_action_steps: string | null
  responsible_person: string | null
} {
  if (steps.length === 0) {
    return { planned_action_steps: null, responsible_person: null }
  }

  const assignees = Array.from(
    new Set(steps.map((s) => s.assignee.trim()).filter(Boolean)),
  ).join(", ")

  return {
    planned_action_steps: JSON.stringify(steps),
    responsible_person: assignees || null,
  }
}
