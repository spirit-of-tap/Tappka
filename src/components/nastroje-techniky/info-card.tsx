import { Info } from "lucide-react"
import { TOOL_TYPES } from "@/lib/nastroje-techniky/constants"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground sm:p-4">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-3">
        <p>
          <strong>Schopnost používat modely, techniky a nástroje pro efektivní práci.</strong>
        </p>
        <ul className="space-y-1.5">
          {TOOL_TYPES.map((type) => (
            <li key={type.value}>
              <strong>{type.label}</strong> — {type.description}
              <br />
              <span className="text-muted-foreground/80">→ {type.benefit}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1">
          <p>
            <strong>Co přidat</strong>
          </p>
          <p>Modely, techniky a nástroje, které:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>ovládáš a pravidelně používáš</li>
            <li>umíš přizpůsobit, vysvětlit ostatním nebo máš k nim certifikaci</li>
          </ul>
          <p>Ke každému záznamu doplň oblast, název a vlastní reflexi.</p>
        </div>
      </div>
    </div>
  )
}
