import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Týmový deník</strong> je chronologický záznam společných aktivit, při kterých tým
          tráví čas mimo pracovní prostředí. Takové akce budují soudržnost týmu, posilují spolupráci
          a tím i týmovou kulturu.
        </p>
        <p>
          Zaznamenávejte všechny společné aktivity — Cabin in the Woods, Learning Circus i formální
          či neformální akce. Deník vyplňujte průběžně, ať jsou informace aktuální a dostupné pro
          budoucí reflexe.
        </p>
      </div>
    </div>
  )
}
