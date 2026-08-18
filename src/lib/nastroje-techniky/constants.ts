import type { Database } from "@/lib/supabase/database.types"

export type ToolType = Database["public"]["Enums"]["tool_type"]

interface ToolTypeInfo {
  value: ToolType
  label: string
  /** Krátké vysvětlení, co daný typ je (pro dropdown a tabulku). */
  description: string
  /** Přínos typu (pro info kartu). */
  benefit: string
}

export const TOOL_TYPES: readonly ToolTypeInfo[] = [
  {
    value: "model",
    label: "Model",
    description: "Teoretický rámec pro pochopení složitých věcí (např. SWOT, Marketing mix).",
    benefit: "Pomáhá strukturovat myšlení, rozhodovat se a řešit komplexní problémy.",
  },
  {
    value: "technique",
    label: "Technika",
    description: "Konkrétní postup, jak něco dělat (např. brainstorming, SMART cíle).",
    benefit: "Zvyšuje produktivitu, organizaci, kreativitu a schopnost reagovat na změny.",
  },
  {
    value: "tool",
    label: "Nástroj",
    description: "Praktický prostředek (např. Trello, Notion, Canva).",
    benefit: "Umožňuje realizaci nápadů, spolupráci, organizaci práce a automatizaci.",
  },
] as const

export function getToolTypeInfo(type: ToolType): ToolTypeInfo {
  const info = TOOL_TYPES.find((t) => t.value === type)
  if (!info) throw new Error(`Neznámý typ nástroje: ${type}`)
  return info
}
