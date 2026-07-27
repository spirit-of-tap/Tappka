import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Individuální koučování</strong> je 1:1 sezení s týmovým koučem. Cílem je
          reflektovat svůj rozvoj a najít konkrétní kroky k dalšímu růstu.
        </p>
        <p>
          Zapiš si, co sis z koučování odnesl a jaké akční kroky z něj vyplynuly —{" "}
          <strong>alespoň jedno sezení za semestr</strong> je očekáváno od každého studenta.
        </p>
      </div>
    </div>
  )
}
