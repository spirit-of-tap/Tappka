import { KASA_COLORS, KASA_MARK_COIN, KASA_MARK_SEGMENTS_PATH } from "@/lib/komunitni-kasa/brand/constants";
import { cn } from "@/lib/utils";

interface KasaMarkProps {
  className?: string;
  /** brand = červená značky, current = barva textu (currentColor). */
  tone?: "brand" | "current";
  /** Bez titulku je značka dekorativní. */
  title?: string;
}

export function KasaMark({ className, tone = "brand", title }: KasaMarkProps) {
  const fill = tone === "brand" ? KASA_COLORS.RED : "currentColor";
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-9 shrink-0", className)}
      {...(title ? { role: "img" } : { "aria-hidden": true })}
    >
      {title ? <title>{title}</title> : null}
      <path fill={fill} d={KASA_MARK_SEGMENTS_PATH} />
      <circle fill={fill} cx={KASA_MARK_COIN.cx} cy={KASA_MARK_COIN.cy} r={KASA_MARK_COIN.r} />
    </svg>
  );
}
