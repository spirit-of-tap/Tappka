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

export interface NavModule {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Hidden unless the user has beta access. */
  betaOnly?: boolean;
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
  { title: "Zák. schůzky", url: "/schuzky", icon: Handshake, betaOnly: true, description: "Evidence zákaznických schůzek." },
  { title: "Koučování", url: "/koucovani", icon: GraduationCap, betaOnly: true, description: "Evidence koučovacích sezení." },
  { title: "Týmová reflexe", url: "/tymova-reflexe", icon: NotebookPen, betaOnly: true, description: "Reflexe týmové spolupráce a semestrální hodnocení." },
  { title: "Týmový deník", url: "/tymovy-denik", icon: Activity, betaOnly: true, description: "Denní zápisy a přehled týmových aktivit." },
  { title: "Týmové dokumenty", url: "/tymove-dokumenty", icon: Files, betaOnly: true, description: "Smlouvy, finanční politika a další dokumenty týmu." },
  { title: "Nástroje a techniky", url: "/nastroje-techniky", icon: Wrench, betaOnly: true, featured: true, description: "Katalog modelů, technik a nástrojů pro práci." },
  { title: "Osobnostní testy", url: "/komunita/profil", icon: Brain, betaOnly: true, ownProfileTab: "osobnostni-testy", description: "Výsledky osobnostních testů na tvém profilu." },
  // Sidebar renders Čtení and Osobnostní testy via title-based special-case branches — keep betaOnly here, and the generic beta branch must run after those special cases.
  { title: "Čtení", url: "/cteni/prehled", icon: BookOpen, betaOnly: true, featured: true, description: "Knihovna knih, eseje a jejich hodnocení." },
  { title: "Birth Giving", url: "/birth-giving", icon: Gift, betaOnly: true, description: "Týmová setkání Birth Giving a retrospektivy." },
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
  "/komunita/profil",
];

/** Modules for the /moduly hub — hub order, beta-gated like the sidebar. */
export function getHubModules(isBeta: boolean): NavModule[] {
  const byUrl = new Map(NAV_MODULES.map((m) => [m.url, m]));
  return MODULE_HUB_ORDER.map((url) => byUrl.get(url)).filter((m): m is NavModule => !!m && (!m.betaOnly || isBeta));
}
