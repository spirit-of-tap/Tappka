import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Týmová reflexe</strong> je pravidelný proces, při kterém se tým ohlíží za svými
          zkušenostmi a výsledky, aby identifikoval úspěchy i oblasti ke zlepšení.
        </p>
        <p>
          Reflexe probíhá <strong>jednou měsíčně</strong> (na konci měsíce před Houston Callingem).
          Výjimkou je leden a květen — místo měsíční reflexe se provádí celosemestrální reflexe.
        </p>
      </div>
    </div>
  )
}
