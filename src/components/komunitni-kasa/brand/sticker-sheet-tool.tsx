"use client";

import { useMemo } from "react";

import { stickerSheetAsset } from "@/lib/komunitni-kasa/brand/assets";
import { AssetPreview } from "./asset-preview";
import { DownloadButtons } from "./download-buttons";

/** A4 arch samolepek připravený k tisku. */
export function StickerSheetTool() {
  const sheet = useMemo(() => stickerSheetAsset(), []);
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] md:items-start">
      <div className="space-y-3">
        <p className="text-sm">A4, 30 samolepek 60 × 25 mm. Tiskni na matný vinyl s laminací.</p>
        <p className="text-sm text-muted-foreground">
          Tiskni ve skutečné velikosti (100 %, bez přizpůsobení stránce), jinak samolepky nebudou mít správný rozměr.
        </p>
        <DownloadButtons asset={sheet} label="arch samolepek" />
      </div>
      <AssetPreview
        asset={sheet}
        label="Náhled archu samolepek"
        className="mx-auto aspect-[210/297] w-full max-w-64 overflow-hidden rounded-md border shadow-sm"
      />
    </div>
  );
}
