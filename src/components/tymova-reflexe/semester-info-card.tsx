import { Info } from "lucide-react"

export function RocnikovaInfoCard() {
  return (
    <div className="flex gap-2.5 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
      <div className="space-y-1.5">
        <p>
          Reflexe je proces aktivního a systematického analyzování událostí a jejich dopadu, které
          nám umožňují identifikovat oblasti, ve kterých je možné se rozvíjet, zlepšovat nebo
          stabilizovat a umět se v nich orientovat.
        </p>
        <p>
          „Neučíme se ze zkušenosti. Učíme se z reflexe zkušenosti.“ — John Dewey. Právě především
          díky komplexní ročníkové reflexi je možné udržovat TAP jako učící se organizaci a
          neustále ho rozvíjet!
        </p>
        <p>
          Ročníkovou reflexi tým vyplňuje <strong>v květnu</strong> na konci každého ročníku po ukončení
          výuky — průběžné vyplňování ale napomůže větší konkrétnosti a rychlejšímu
          rozvoji. Konkrétní termín odevzdání se dozvíte s předstihem od koučů:ek, případně od vedení TAP.
        </p>
      </div>
    </div>
  )
}

export const SemesterInfoCard = RocnikovaInfoCard
