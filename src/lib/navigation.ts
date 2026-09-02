import {
  Activity,
  BookOpen,
  Brain,
  CalendarDays,
  Files,
  Gift,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  NotebookPen,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { canAccessFeature, type AccessProfile, type BetaFeature } from "./feature-access";

export interface NavModule {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Feature key for cohort gating — hidden unless canAccessFeature(profile, feature). */
  feature?: BetaFeature;
  /** Opens in a new browser tab; used only by dev-tool items. */
  external?: boolean;
  /** When set, links to the signed-in user's own profile tab: /komunita/profil/:id?tab=<value>. Requires profileId at render time. */
  ownProfileTab?: string;
  /** One-line description shown on module cards. */
  description: string;
  /** Renders as a full-width featured card on the /moduly hub (high-traffic modules). */
  featured?: boolean;
}

export const NAV_MODULES: NavModule[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, description: "Přehled tvých aktivit a rychlé akce." },
  { title: "Místnosti", url: "/reservations", icon: CalendarDays, featured: true, description: "Rezervace místností a jejich nastavení." },
  { title: "Komunita", url: "/komunita", icon: Users, description: "Lidé, týmy a profily v Tiimiakatemii." },
  { title: "Zák. schůzky", url: "/schuzky", icon: Handshake, feature: "customerMeetings", description: "Evidence zákaznických schůzek." },
  { title: "Koučování", url: "/koucovani", icon: GraduationCap, feature: "coaching", description: "Evidence koučovacích sezení." },
  { title: "Týmová reflexe", url: "/tymova-reflexe", icon: NotebookPen, feature: "teamReflection", description: "Reflexe týmové spolupráce a ročníková hodnocení." },
  { title: "Týmový deník", url: "/tymovy-denik", icon: Activity, feature: "teamDiary", description: "Denní zápisy a přehled týmových aktivit." },
  { title: "Týmové dokumenty", url: "/tymove-dokumenty", icon: Files, feature: "teamDocuments", description: "Smlouvy, finanční politika a další dokumenty týmu." },
  { title: "Nástroje a techniky", url: "/nastroje-techniky", icon: Wrench, feature: "toolsTechniques", featured: true, description: "Katalog modelů, technik a nástrojů pro práci." },
  { title: "Osobnostní testy", url: "/osobnostni-testy", icon: Brain, feature: "personalityTests", description: "Výsledky osobnostních testů a jejich vývoj v čase." },
  // Čtení renders as a plain link; its sub-navigation lives in
  // src/app/(main)/cteni/layout.tsx as a tab bar.
  { title: "Čtení", url: "/cteni/prehled", icon: BookOpen, feature: "reading", featured: true, description: "Knihovna knih, eseje a jejich hodnocení." },
  { title: "Birth Giving", url: "/birth-giving", icon: Gift, feature: "birthGiving", description: "Týmová setkání Birth Giving a retrospektivy." },
];

/** /moduly hub card order — by visit frequency, most visited first (product owner data).
 *  Deliberately excludes Dashboard and Komunita (permanent bottom-bar tabs). */
export const MODULE_HUB_ORDER: string[] = [
  "/cteni/prehled",
  "/reservations",
  "/nastroje-techniky",
  "/schuzky",
  "/tymova-reflexe",
  "/tymovy-denik",
  "/tymove-dokumenty",
  "/koucovani",
  "/birth-giving",
  "/osobnostni-testy",
];

/** Modules for the /moduly hub — hub order, cohort-gated via feature keys. */
export function getHubModules(profile: AccessProfile | null | undefined | boolean): NavModule[] {
  const byUrl = new Map(NAV_MODULES.map((m) => [m.url, m]));
  return MODULE_HUB_ORDER.map((url) => byUrl.get(url)).filter((m): m is NavModule => {
    if (!m) return false;
    if (!m.feature) return true;
    if (typeof profile === "boolean") return profile;
    return canAccessFeature(profile, m.feature);
  });
}
