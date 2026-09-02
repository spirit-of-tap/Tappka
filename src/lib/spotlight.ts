import {
  Activity,
  Bell,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  Files,
  FlaskConical,
  Gift,
  GraduationCap,
  Handshake,
  Heart,
  LayoutDashboard,
  LayoutGrid,
  NotebookPen,
  SlidersHorizontal,
  User,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { canAccessFeature, type BetaCohort, type BetaFeature } from "./feature-access";

export interface SpotlightItem {
  id: string;
  title: string;
  description: string;
  url: string;
  feature?: BetaFeature;
  adminOnly?: boolean;
  coachOrAdminOnly?: boolean;
  icon: LucideIcon;
  keywords: string[];
}

export interface SpotlightUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  beta_access?: boolean;
  beta_access_granted_at?: string | null;
  beta_cohort?: BetaCohort;
}

export const RAW_SPOTLIGHT_ITEMS: SpotlightItem[] = [
  {
    id: "page-dashboard",
    title: "Dashboard",
    description: "Přehled tvých aktivit a rychlé akce",
    url: "/",
    icon: LayoutDashboard,
    keywords: [
      "dashboard",
      "domů",
      "domov",
      "nástěnka",
      "home",
      "přehled",
      "aktivity",
      "úvod",
      "hlavní stránka",
    ],
  },
  {
    id: "page-reservations",
    title: "Místnosti a rezervace",
    description: "Rezervace místností a jejich rozvrh",
    url: "/reservations",
    icon: CalendarDays,
    keywords: [
      "místnosti",
      "rezervace",
      "rezervovat",
      "zarezervovat místnost",
      "zarezervovat zasedačku",
      "chci zarezervovat místnost",
      "volná místnost",
      "pokoje",
      "zasedačky",
      "kalendář",
      "rozvrh",
      "nová rezervace",
      "kde je místnost",
      "booking",
      "rooms",
    ],
  },
  {
    id: "page-komunita",
    title: "Komunita",
    description: "Lidé, týmy a profily v Tiimiakatemii",
    url: "/komunita",
    icon: Users,
    keywords: [
      "komunita",
      "lidé",
      "profily",
      "týmy",
      "studující",
      "studenti",
      "kouči:ky",
      "kouči",
      "koučky",
      "spolužáci",
      "hledat člověka",
      "lidé v tapu",
      "tým",
      "community",
      "people",
      "teams",
    ],
  },
  {
    id: "page-cteni",
    title: "Čtení a knihovna",
    description: "Knihovna knih, eseje a jejich hodnocení",
    url: "/cteni/prehled",
    icon: BookOpen,
    keywords: [
      "čtení",
      "knihy",
      "knížky",
      "kniha",
      "knihovna",
      "eseje",
      "esej",
      "napsat esej",
      "napsat novou esej",
      "napsat novou eseje",
      "chci napsat esej",
      "chci napsat novou esej",
      "chci kde napsat eseje",
      "kde napsat esej",
      "kde odevzdat esej",
      "odevzdat esej",
      "jak napsat esej",
      "půjčit knihu",
      "katalog knih",
      "hledat knihu",
      "přidat knihu",
      "recenze",
      "hodnocení esejí",
      "kontrola esejí",
      "top bob",
      "rocket model",
      "četba",
      "reading",
      "books",
      "library",
      "essays",
    ],
  },
  {
    id: "page-schuzky",
    title: "Zákaznické schůzky",
    description: "Evidence a přehled zákaznických schůzek",
    url: "/schuzky",
    icon: Handshake,
    feature: "customerMeetings",
    keywords: [
      "schůzky",
      "zákaznické schůzky",
      "schůzka",
      "zákazníci",
      "zákazník",
      "klienti",
      "klient",
      "nová schůzka",
      "zapsat schůzku",
      "chci zapsat schůzku",
      "evidence schůzek",
      "kde najdu zákaznické schůzky",
      "obchod",
      "sales",
      "meetings",
      "crm",
    ],
  },
  {
    id: "page-koucovani",
    title: "Koučování",
    description: "Evidence a záznamy koučovacích sezení",
    url: "/koucovani",
    icon: GraduationCap,
    feature: "coaching",
    keywords: [
      "koučování",
      "kouč:ka",
      "kouč",
      "koučka",
      "sezení",
      "koučovací sezení",
      "zapsat koučování",
      "nové sezení",
      "záznam koučování",
      "coaching",
      "coach",
    ],
  },
  {
    id: "page-tymova-reflexe",
    title: "Týmová reflexe",
    description: "Reflexe týmové spolupráce a ročníková hodnocení",
    url: "/tymova-reflexe",
    icon: NotebookPen,
    feature: "teamReflection",
    keywords: [
      "reflexe",
      "týmová reflexe",
      "kde jsou týmové reflexe",
      "nová reflexe",
      "semestrální reflexe",
      "ročníková reflexe",
      "hodnocení týmu",
      "zapsat reflexi",
      "udělat reflexi",
      "hodnocení semestru",
      "hodnocení roku",
      "team reflection",
    ],
  },
  {
    id: "page-tymovy-denik",
    title: "Týmový deník",
    description: "Denní zápisy a přehled týmových aktivit",
    url: "/tymovy-denik",
    icon: Activity,
    feature: "teamDiary",
    keywords: [
      "týmový deník",
      "kde najdu týmový deník",
      "deník",
      "zápisy",
      "aktivity",
      "nový zápis",
      "zapsat do deníku",
      "denní zápis",
      "záznam",
      "log",
      "diary",
    ],
  },
  {
    id: "page-tymove-dokumenty",
    title: "Týmové dokumenty",
    description: "Smlouvy, finanční politika a další dokumenty",
    url: "/tymove-dokumenty",
    icon: Files,
    feature: "teamDocuments",
    keywords: [
      "dokumenty",
      "týmové dokumenty",
      "smlouvy",
      "finance",
      "finanční politika",
      "contract",
      "soubory",
      "pravidla týmu",
      "kde najdu smlouvy",
      "smlouvy a finance",
      "documents",
      "files",
    ],
  },
  {
    id: "page-nastroje-techniky",
    title: "Nástroje a techniky",
    description: "Katalog modelů, technik a nástrojů pro práci",
    url: "/nastroje-techniky",
    icon: Wrench,
    feature: "toolsTechniques",
    keywords: [
      "nástroje a techniky",
      "nástroje",
      "techniky",
      "modely",
      "frameworky",
      "canvas",
      "lean canvas",
      "metody",
      "postupy",
      "šablony",
      "tools",
    ],
  },
  {
    id: "page-osobnostni-testy",
    title: "Osobnostní testy",
    description: "Výsledky osobnostních testů a jejich vývoj v čase",
    url: "/osobnostni-testy",
    icon: Brain,
    feature: "personalityTests",
    keywords: [
      "osobnostní testy",
      "testy",
      "osobnost",
      "mbti",
      "dynamika",
      "silné stránky",
      "výsledky testů",
      "personality tests",
    ],
  },
  {
    id: "page-birth-giving",
    title: "Birth Giving",
    description: "Týmová setkání Birth Giving a retrospektivy",
    url: "/birth-giving",
    icon: Gift,
    feature: "birthGiving",
    keywords: [
      "birth giving",
      "setkání",
      "retrospektivy",
      "retro",
      "nové setkání",
      "birthgiving",
      "záznam setkání",
      "projekty",
    ],
  },
  {
    id: "page-moduly",
    title: "Všechny moduly",
    description: "Kompletní rozcestník všech modulů Tappky",
    url: "/moduly",
    icon: LayoutGrid,
    keywords: [
      "všechny moduly",
      "moduly",
      "rozcestník",
      "hub",
      "přehled modulů",
      "modules",
      "all",
    ],
  },
  {
    id: "page-portfolio",
    title: "Portfolio",
    description: "Přehled tvých projektů a výstupů",
    url: "/portfolio",
    icon: BriefcaseBusiness,
    feature: "portfolio",
    keywords: [
      "portfolio",
      "projekty",
      "výstupy",
      "práce",
      "moje projekty",
      "projects",
    ],
  },
  {
    id: "profile-me",
    title: "Můj profil",
    description: "Zobrazit a upravit tvůj profil a účet",
    url: "/profil",
    icon: User,
    keywords: [
      "můj profil",
      "můj profil a nastavení",
      "můj profil a údaje",
      "profil",
      "účet",
      "nastavení účtu",
      "moje údaje",
      "změnit fotku",
      "bio",
      "upravit profil",
      "profile",
      "account",
      "me",
    ],
  },
  {
    id: "profile-notifications",
    title: "Notifikace",
    description: "Nastavení e-mailových a systémových upozornění",
    url: "/settings/notifikace",
    icon: Bell,
    keywords: [
      "notifikace",
      "upozornění",
      "oznámení",
      "e-maily",
      "nastavení notifikací",
      "upozornit",
      "notifications",
      "alerts",
    ],
  },
  {
    id: "page-reservation-settings",
    title: "Nastavení místností",
    description: "Konfigurace a pravidla rezervací místností",
    url: "/reservations/settings",
    icon: SlidersHorizontal,
    coachOrAdminOnly: true,
    keywords: [
      "nastavení místností",
      "správa místností",
      "pravidla rezervací",
      "room settings",
    ],
  },
  {
    id: "page-feedback",
    title: "Zpětná vazba",
    description: "Náměty na vylepšení a zpětná vazba pro tým Tappky",
    url: "/zpetna-vazba",
    icon: Heart,
    keywords: [
      "zpětná vazba",
      "feedback",
      "podpora",
      "nápady",
      "náměty",
      "připomínky",
      "nahlásit chybu",
      "kontakt",
    ],
  },
  {
    id: "profile-beta",
    title: "Beta program",
    description: "Přístup k experimentálním funkcím a novinkám",
    url: "/beta",
    icon: FlaskConical,
    keywords: [
      "beta program",
      "beta přístup",
      "experimenty",
      "testování novinek",
      "early access",
    ],
  },
];

const STOP_WORDS = new Set([
  "chci",
  "kde",
  "jak",
  "co",
  "pro",
  "na",
  "v",
  "ve",
  "do",
  "k",
  "ke",
  "o",
  "a",
  "i",
  "se",
  "si",
  "je",
  "jsou",
  "to",
  "ten",
  "ta",
  "ty",
  "mít",
  "najít",
  "najdu",
  "nastavit",
  "zobrazit",
]);

export function normalizeSearchString(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreSpotlightSearch(
  item: SpotlightItem,
  search: string,
): number {
  const normalizedQuery = normalizeSearchString(search);
  if (!normalizedQuery) return 1;

  const normalizedTitle = normalizeSearchString(item.title);
  const normalizedDesc = normalizeSearchString(item.description);
  const normalizedKeywords = item.keywords.map(normalizeSearchString);
  const allKeywordsText = normalizedKeywords.join(" ");

  // Exact phrase match in title -> highest score
  if (normalizedTitle === normalizedQuery) return 1000;
  if (normalizedTitle.startsWith(normalizedQuery)) return 800;
  if (normalizedTitle.includes(normalizedQuery)) return 600;

  // Exact phrase match in keywords -> high score
  if (normalizedKeywords.some((k) => k === normalizedQuery)) return 500;
  if (normalizedKeywords.some((k) => k.startsWith(normalizedQuery))) return 400;
  if (allKeywordsText.includes(normalizedQuery)) return 300;

  // Split query into tokens
  const rawTokens = normalizedQuery.split(" ").filter(Boolean);
  if (rawTokens.length === 0) return 1;

  // Filter out stop words unless all tokens are stop words
  const meaningfulTokens = rawTokens.filter((t) => !STOP_WORDS.has(t));
  const tokensToMatch = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  let matchedTokens = 0;
  let score = 0;

  for (const token of tokensToMatch) {
    let tokenMatched = false;

    // Check title match
    if (normalizedTitle.includes(token)) {
      tokenMatched = true;
      score += normalizedTitle.startsWith(token) ? 80 : 50;
    }

    // Check keyword match
    for (const kw of normalizedKeywords) {
      if (kw === token) {
        tokenMatched = true;
        score += 70;
        break;
      } else if (kw.startsWith(token)) {
        tokenMatched = true;
        score += 50;
        break;
      } else if (kw.includes(token)) {
        tokenMatched = true;
        score += 30;
        break;
      } else if (
        token.length >= 4 &&
        (kw.startsWith(token.slice(0, -1)) || kw.startsWith(token.slice(0, -2)))
      ) {
        tokenMatched = true;
        score += 25;
        break;
      }
    }

    // Check description match
    if (!tokenMatched && normalizedDesc.includes(token)) {
      tokenMatched = true;
      score += 15;
    }

    if (tokenMatched) {
      matchedTokens++;
    }
  }

  // If at least one meaningful token matched, or if all tokens matched:
  if (matchedTokens === tokensToMatch.length) {
    return score + 100;
  }
  if (matchedTokens > 0) {
    return score;
  }

  return 0;
}

export function getSpotlightItems({
  user,
}: {
  user?: SpotlightUser;
}): SpotlightItem[] {
  const isCoachOrAdmin = user?.role === "coach" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const accessProfile = user
    ? {
        role: user.role ?? "student",
        beta_access_granted_at:
          user.beta_access_granted_at ?? (user.beta_access ? "1970-01-01T00:00:00Z" : null) ?? null,
        beta_cohort: (user.beta_cohort ?? (user.beta_access ? "B" : "A")) as BetaCohort,
      }
    : null;

  return RAW_SPOTLIGHT_ITEMS.filter((item) => {
    if (item.feature && !canAccessFeature(accessProfile, item.feature)) {
      return false;
    }
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    if (item.coachOrAdminOnly && !isCoachOrAdmin) {
      return false;
    }
    return true;
  }).map((item) => {
    if (item.id === "profile-me" && user?.id) {
      return {
        ...item,
        url: `/komunita/profil/${user.id}`,
      };
    }
    return item;
  });
}
