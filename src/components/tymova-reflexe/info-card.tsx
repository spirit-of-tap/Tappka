import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2.5 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
      <div className="space-y-1.5">
        <p>
          <strong>Týmová reflexe</strong> je pravidelný proces, při kterém se tým ohlíží za svými
          zkušenostmi a výsledky, aby identifikoval úspěchy i oblasti ke zlepšení.
        </p>
        <p>
          Měsíční reflexe probíhá <strong>jednou měsíčně</strong> (říjen až květen).
          V květnu na konci akademického roku probíhá navíc komplexní <strong>ročníková reflexe</strong> hodnotící celý studijní ročník v 11 oblastech.
        </p>
      </div>
    </div>
  )
}
