import { createLucideIcon } from "lucide-react";

import { KASA_MARK_COIN, KASA_MARK_SEGMENTS_PATH } from "./constants";

/** Značka (100 × 100) zmenšená na mřížku lucide ikon (24 × 24). */
const SCALE = 24 / 100;

/**
 * Šestidílná značka kasy jako lucide ikona — do menu a sidebaru, ve stejné
 * barvě jako ostatní ikony (currentColor, plná výplň místo tahu).
 */
export const KasaIcon = createLucideIcon("komunitni-kasa", [
  ["path", { d: KASA_MARK_SEGMENTS_PATH, fill: "currentColor", stroke: "none", transform: `scale(${SCALE})`, key: "segments" }],
  [
    "circle",
    {
      cx: String(KASA_MARK_COIN.cx * SCALE),
      cy: String(KASA_MARK_COIN.cy * SCALE),
      r: String(KASA_MARK_COIN.r * SCALE),
      fill: "currentColor",
      stroke: "none",
      key: "coin",
    },
  ],
]);
