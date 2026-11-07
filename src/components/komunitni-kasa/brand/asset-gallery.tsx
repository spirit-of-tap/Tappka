"use client";

import { Archive, Loader2 } from "lucide-react";

import { KASA_ASSETS } from "@/lib/komunitni-kasa/brand/assets";
import { downloadAllAssetsZip } from "@/lib/komunitni-kasa/brand/export";
import { Button } from "@/components/ui/button";
import { AssetPreview } from "./asset-preview";
import { DownloadButtons } from "./download-buttons";
import { useDownload } from "./use-download";

/** Všechny soubory značky s náhledem a stažením. */
export function AssetGallery() {
  const { run, pending } = useDownload();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          SVG pro tisk a úpravy, PNG pro sítě, slidy a dokumenty. Písma jsou v souborech vložená.
        </p>
        <Button onClick={() => run("zip", () => downloadAllAssetsZip(KASA_ASSETS))} disabled={pending !== null} className="gap-1.5">
          {pending === "zip" ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Archive className="size-4" aria-hidden />
          )}
          {pending === "zip" ? "Připravuji balíček…" : "Stáhnout vše (ZIP)"}
        </Button>
      </div>
      <ul className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {KASA_ASSETS.map((asset) => (
          <li key={asset.id} className="space-y-3">
            <AssetPreview asset={asset} className="aspect-[4/3] overflow-hidden rounded-lg border" />
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold">{asset.name}</h3>
              <p className="text-xs text-muted-foreground">{asset.hint}</p>
            </div>
            <DownloadButtons asset={asset} />
          </li>
        ))}
      </ul>
    </div>
  );
}
