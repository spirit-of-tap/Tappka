"use client";

import { useMemo, useState } from "react";

import { rolePosterAsset, type RolePosterFields } from "@/lib/komunitni-kasa/brand/assets";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssetPreview } from "./asset-preview";
import { DownloadButtons } from "./download-buttons";

const FIELDS: { key: keyof Omit<RolePosterFields, "napln">; label: string; placeholder: string }[] = [
  { key: "role", label: "Role", placeholder: "Správa klubovny" },
  { key: "kdo", label: "Kdo ji zastává", placeholder: "Jméno Příjmení" },
  { key: "druzstvo", label: "Družstvo", placeholder: "Název družstva" },
  { key: "obdobi", label: "Období", placeholder: "září–prosinec 2026" },
];

const NAPLN_PLACEHOLDER =
  "Koordinuje společné akce a setkání TAP Spirit, pečuje o klubovnu a společné vybavení a sbírá potřeby družstev pro měsíční plán výdajů.";

const EMPTY: RolePosterFields = { role: "", kdo: "", druzstvo: "", obdobi: "", napln: "" };

/** Formulář → A4 plakát komunitní role. */
export function RolePosterTool() {
  const [fields, setFields] = useState<RolePosterFields>(EMPTY);
  const poster = useMemo(() => rolePosterAsset(fields), [fields]);
  const set = (key: keyof RolePosterFields) => (e: { target: { value: string } }) =>
    setFields((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:items-start">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`plakat-${key}`}>{label}</Label>
              <Input id={`plakat-${key}`} value={fields[key]} onChange={set(key)} placeholder={placeholder} />
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plakat-napln">Náplň role</Label>
          <Textarea
            id="plakat-napln"
            value={fields.napln}
            onChange={set("napln")}
            placeholder={NAPLN_PLACEHOLDER}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">Na plakát se vejde zhruba 6 řádků.</p>
        </div>
        <DownloadButtons asset={poster} label="plakát" />
      </div>
      <AssetPreview
        asset={poster}
        label="Náhled plakátu"
        className="mx-auto aspect-[210/297] w-full max-w-64 overflow-hidden rounded-md border shadow-sm"
      />
    </div>
  );
}
