import { buildSvgPreview, type KasaAsset } from "@/lib/komunitni-kasa/brand/assets";
import { cn } from "@/lib/utils";

/**
 * Inline SVG náhled. Bezpečné pro dangerouslySetInnerHTML: šablony jsou
 * statické a uživatelské texty (plakát) escapuje `escapeSvgText`.
 */
export function AssetPreview({ asset, label, className }: { asset: KasaAsset; label?: string; className?: string }) {
  return (
    <div
      className={cn("[&>svg]:block [&>svg]:h-full [&>svg]:w-full", className)}
      dangerouslySetInnerHTML={{ __html: buildSvgPreview(asset, label) }}
    />
  );
}
