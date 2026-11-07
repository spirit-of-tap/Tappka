"use client";

import { Download, Loader2 } from "lucide-react";

import { downloadAsset } from "@/lib/komunitni-kasa/brand/export";
import type { KasaAsset } from "@/lib/komunitni-kasa/brand/assets";
import { Button } from "@/components/ui/button";
import { useDownload } from "./use-download";

const FORMATS = ["svg", "png"] as const;

/** Tlačítka SVG + PNG pro jeden soubor. */
export function DownloadButtons({ asset, label = asset.name }: { asset: KasaAsset; label?: string }) {
  const { run, pending } = useDownload();
  return (
    <div className="flex gap-2">
      {FORMATS.map((format) => {
        const key = `${asset.id}:${format}`;
        return (
          <Button
            key={format}
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={pending !== null}
            onClick={() => run(key, () => downloadAsset(asset, format))}
            aria-label={`Stáhnout ${label} jako ${format.toUpperCase()}`}
          >
            {pending === key ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            {format.toUpperCase()}
          </Button>
        );
      })}
    </div>
  );
}
