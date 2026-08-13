import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Zákaznická schůzka</strong> je setkání s člověkem z praxe, jehož cílem je získat
          know-how. Předem si stanovíš, co chceš zjistit a proč — každá schůzka by tě ideálně měla
          přiblížit k cíli z tvého <strong>learning kontraktu</strong>.
        </p>
        <p>
          Po schůzce reflektuješ, co z toho využiješ v praxi.{" "}
          <strong>Nejde o prodej</strong>, ale o učení se od zkušenějších lidí.
        </p>
      </div>
    </div>
  )
}
