import { X } from "lucide-react";

import { KASA_COLOR_SPECS } from "@/lib/komunitni-kasa/brand/constants";
import { KASA_DONTS, KASA_PLACEMENT_OWNER, KASA_PLACEMENTS, KASA_SIZE_RULES } from "@/lib/komunitni-kasa/brand/guidelines";
import { cn } from "@/lib/utils";
import { KasaMark } from "../kasa-mark";
import { CopyButton } from "./copy-button";

const DONT_MARK_CLASS: Record<(typeof KASA_DONTS)[number]["id"], string> = {
  deformovat: "scale-x-150 scale-y-75",
  barvy: "text-chart-3",
  efekty: "drop-shadow-[0_6px_4px_rgb(0_0_0/0.45)] blur-[0.5px]",
  otacet: "rotate-[30deg]",
};

function SubHeading({ children }: { children: string }) {
  return <h3 className="font-heading text-base font-semibold">{children}</h3>;
}

/** Barvy, písmo, velikosti, zákazy a umístění podle média. */
export function UsageRules() {
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <SubHeading>Barvy</SubHeading>
        <ul className="grid gap-4 sm:grid-cols-3">
          {KASA_COLOR_SPECS.map((color) => (
            <li key={color.hex} className="overflow-hidden rounded-lg border">
              {/* Barevný vzorek je brandová data, ne UI barva — kreslí se jako SVG výplň. */}
              <svg viewBox="0 0 100 32" className="block h-16 w-full" aria-hidden preserveAspectRatio="none">
                <rect width="100" height="32" fill={color.hex} />
              </svg>
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="space-y-0.5 text-xs text-muted-foreground tabular-nums">
                  <p className="text-sm font-semibold text-foreground">{color.name}</p>
                  <p>HEX {color.hex}</p>
                  <p>RGB {color.rgb}</p>
                  <p>CMYK {color.cmyk}</p>
                </div>
                <CopyButton text={color.hex} successMessage={`${color.hex} zkopírováno`} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <SubHeading>Písmo</SubHeading>
          <p className="font-heading text-2xl font-bold">komunitní kasy</p>
          <p className="text-xs text-muted-foreground">Nadpisy: Poppins Bold</p>
          <p className="text-base">Financováno z · Spirit of TAP, z.s.</p>
          <p className="text-xs text-muted-foreground">Text: Roboto Regular</p>
        </div>
        <div className="space-y-3">
          <SubHeading>Velikost a okolí</SubHeading>
          <dl className="space-y-2 text-sm">
            {KASA_SIZE_RULES.map((rule) => (
              <div key={rule.title}>
                <dt className="font-medium">{rule.title}</dt>
                <dd className="text-muted-foreground">{rule.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="space-y-4">
        <SubHeading>Čemu se vyhnout</SubHeading>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {KASA_DONTS.map((dont) => (
            <li key={dont.id} className="space-y-2">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                <KasaMark className={cn("size-14", DONT_MARK_CLASS[dont.id])} tone={dont.id === "barvy" ? "current" : "brand"} />
                <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-destructive text-white">
                  <X className="size-4" aria-hidden />
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{dont.label}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <SubHeading>Kam značku dát</SubHeading>
        <dl className="divide-y border-y">
          {KASA_PLACEMENTS.map((placement) => (
            <div key={placement.medium} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-sm font-medium">{placement.medium}</dt>
              <dd className="text-sm text-muted-foreground">{placement.rule}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">{KASA_PLACEMENT_OWNER}</p>
      </div>
    </div>
  );
}
