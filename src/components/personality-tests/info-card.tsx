import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Osobnostní test</strong> slouží k hodnocení a pochopení charakterových rysů,
          chování a preferencí téček. Pomáhá identifikovat silné a slabé stránky, motivace
          a způsob interakce s okolím.
        </p>
        <p>
          Osobnostní test si každé téčko dělá v 1. semestru. Následně ho zkonzultuje
          s koučem:kou. Slouží jako podklad pro Learning contract.
        </p>
      </div>
    </div>
  )
}
