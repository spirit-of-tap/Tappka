import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1.5">
        <p>
          <strong>Birth Giving</strong> je intenzivní inovační sprint nebo hackathon (obvykle 8 nebo 24 hodin),
          kde týmy řeší reálné zadání pro zákazníka z praxe.
        </p>
        <p>
          <strong>Jak to probíhá:</strong> Zadání je utajené až do začátku akce. Během události týmy pracují
          na řešení a na konci odevzdají své výstupy. Po akci každý:člen:ka vyplní svou osobní reflexi.
        </p>
        <p>
          Cílem je absolvovat <strong>2 Birth Giving za semestr</strong> a celkem <strong>9 za celé studium</strong> (minimálně 7).
        </p>
      </div>
    </div>
  )
}
