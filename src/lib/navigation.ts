import {
  Activity,
  BookOpen,
  Brain,
  CalendarDays,
  CalendarRange,
  Files,
  Gift,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  NotebookPen,
  Presentation,
  Rocket,
  Timer,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { KasaIcon } from "@/lib/komunitni-kasa/brand/kasa-icon";
import { canAccessFeature, type AccessProfile, type BetaFeature } from "./feature-access";

/** Sidebar group for in-app modules; modules without one stay in "Společné". */
export type NavGroup = "individual" | "team";

export interface NavModule {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Feature key for cohort gating — hidden unless canAccessFeature(profile, feature). */
  feature?: BetaFeature;
  /** Opens in a new browser tab instead of navigating inside the app. */
  external?: boolean;
  /** When set, links to the signed-in user's own profile tab: /komunita/profil/:id?tab=<value>. Requires profileId at render time. */
  ownProfileTab?: string;
  /** One-line description shown on module cards. */
  description: string;
  /** Renders as a full-width featured card on the /moduly hub (high-traffic modules). */
  featured?: boolean;
  group?: NavGroup;
}

export const HARMONOGRAM_URL = "https://docs.google.com/spreadsheets/d/1NLVDSlRzAAg0JysRx6F6qaMs5Vh96Pe4NLRSPzWzGBY/edit?gid=204439";

export const NAV_MODULES: NavModule[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, description: "Přehled tvých aktivit a rychlé akce." },
  { title: "Místnosti", url: "/reservations", icon: CalendarDays, featured: true, description: "Rezervace místností a jejich nastavení." },
  { title: "Harmonogram", url: HARMONOGRAM_URL, icon: CalendarRange, external: true, description: "Aktuální harmonogram školy a rozvrhu." },
  { title: "Komunita", url: "/komunita", icon: Users, description: "Lidé, týmy a profily v Tiimiakatemii." },
  { title: "Komunitní kasa", url: "/komunitni-kasa", icon: KasaIcon, description: "Stav kasy, kam jdou peníze, pravidla a značka." },
  { title: "Zák. schůzky", url: "/schuzky", group: "individual", icon: Handshake, feature: "customerMeetings", description: "Evidence zákaznických schůzek." },
  { title: "Koučování", url: "/koucovani", group: "individual", icon: GraduationCap, feature: "coaching", description: "Evidence koučovacích sezení." },
  { title: "Týmová reflexe", url: "/tymova-reflexe", group: "team", icon: NotebookPen, feature: "teamReflection", description: "Reflexe týmové spolupráce a ročníková hodnocení." },
  { title: "Týmový deník", url: "/tymovy-denik", group: "team", icon: Activity, feature: "teamDiary", description: "Denní zápisy a přehled týmových aktivit." },
  { title: "Čas", url: "/cas", group: "individual", icon: Timer, description: "Časomíra a přehled času ve směrech Training / Reading / Practise / Projekt." },
  { title: "Training sessions", url: "/ts/prehled", group: "team", icon: Presentation, description: "Tréninkové sessions týmů, příprava, docházka a reflexe." },
  { title: "Rocket Model", url: "/rocket-model", group: "team", icon: Rocket, feature: "rocketModel", description: "Osobní a týmové hodnocení podle Rocket Modelu." },
  { title: "Týmové dokumenty", url: "/tymove-dokumenty", group: "team", icon: Files, feature: "teamDocuments", description: "Smlouvy, finanční politika a další dokumenty týmu." },
  { title: "Nástroje a techniky", url: "/nastroje-techniky", icon: Wrench, feature: "toolsTechniques", featured: true, description: "Katalog modelů, technik a nástrojů pro práci." },
  { title: "Osobnostní testy", url: "/osobnostni-testy", group: "individual", icon: Brain, feature: "personalityTests", description: "Výsledky osobnostních testů a jejich vývoj v čase." },
  // Čtení renders as a plain link; its sub-navigation lives in
  // src/app/(main)/cteni/layout.tsx as a tab bar.
  { title: "Čtení", url: "/cteni/prehled", group: "individual", icon: BookOpen, featured: true, description: "Knihovna knih, eseje a jejich hodnocení." },
  { title: "Birth Giving", url: "/birth-giving", group: "team", icon: Gift, feature: "birthGiving", description: "Týmová setkání Birth Giving a retrospektivy." },
];

/** /moduly hub card order — by visit frequency, most visited first (product owner data).
 *  Deliberately excludes Dashboard and Komunita (permanent bottom-bar tabs). */
export const MODULE_HUB_ORDER: string[] = [
  "/cteni/prehled",
  "/reservations",
  HARMONOGRAM_URL,
  "/komunitni-kasa",
  "/ts/prehled",
  "/nastroje-techniky",
  "/schuzky",
  "/tymova-reflexe",
  "/tymovy-denik",
  "/cas",
  "/rocket-model",
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

/** Colour family of a sidebar section: its dot and the icon chips of its items. */
export type NavTone = "shared" | "individual" | "team" | "neutral";

export interface NavSection {
  title: string;
  /** One line under the title saying who the modules are for. */
  hint?: string;
  tone: NavTone;
  items: NavModule[];
}

const NAV_GROUPS: Record<NavGroup, { title: string; hint: string }> = {
  individual: { title: "Můj rozvoj", hint: "Tvoje vlastní práce a růst" },
  team: { title: "Můj tým", hint: "Co děláte společně jako tým" },
};

/**
 * Sidebar grouping: shared modules in "Společné", then individual and team
 * modules; external links get their own section so they never read as in-app
 * modules.
 */
export function getSidebarSections(devItems: NavModule[] = []): NavSection[] {
  const internal = NAV_MODULES.filter((m) => !m.external);
  const external = NAV_MODULES.filter((m) => m.external);
  const grouped = (Object.keys(NAV_GROUPS) as NavGroup[]).map((group) => ({
    ...NAV_GROUPS[group],
    tone: group,
    items: internal.filter((m) => m.group === group),
  }));

  return [
    {
      title: "Společné",
      hint: "Pro celou akademii",
      tone: "shared",
      items: internal.filter((m) => !m.group),
    },
    ...grouped,
    ...(external.length > 0
      ? [{ title: "Externí odkazy", tone: "neutral" as const, items: external }]
      : []),
    ...(devItems.length > 0 ? [{ title: "Dev", tone: "neutral" as const, items: devItems }] : []),
  ];
}
