import { Info } from "lucide-react"

export function InfoCard() {
  return (
    <div className="flex gap-2 rounded-lg border border-border/50 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
      <div className="space-y-1">
        <p>
          <strong>Esej</strong> nemusí být dokonalé literární dílo a nemá stanovenou podobu. Zásadní
          je, aby byla psaná formou <strong>ATP</strong> (aplikace teorie v praxi) — tedy reflektovala,
          jak získané znalosti dokážete převést do praxe. Nejdůležitější je kvalita
          reflexe na získané myšlenky, nástroje a poznatky; nejde o přepisování obsahu.
        </p>
        <p>
          Eseji, které ATP chybí, má kouč:ka právo vrátit k přepracování či ji následně bodově neuznat.
        </p>
        <p>
          V rámci studia přečtete knihy za <strong>120 bodů</strong>. Za jednu
          přečtenou knihu lze získat <strong>1–3 body</strong> po napsání eseje a nahrání do esejbanky.
        </p>
      </div>
    </div>
  )
}