/**
 * Směrnice o rozhodování o výdajích — text přepsaný z
 * `kom_kasa/dokumenty/smernice_o_vydajich_obsah.tex` a srozumitelné shrnutí
 * pro stránku kasy. Po schválení per rollam stačí přepnout SMERNICE_IS_DRAFT.
 */
import type { StanovyArticle } from "./types";

export const SMERNICE_IS_DRAFT = true;
export const SMERNICE_TITLE = "Směrnice o rozhodování o výdajích";
export const SMERNICE_DRAFT_LABEL = "Návrh · zatím neschváleno";
export const SMERNICE_DRAFT_NOTE =
  "Směrnice čeká na schválení družstvy (per rollam č. 3/2026). Do té doby jde o návrh pravidel.";
export const SMERNICE_BASIS = "podle čl. 12 odst. 3 písm. n) a čl. 15 odst. 2 stanov";

export const SMERNICE_ARTICLES: StanovyArticle[] = [
  {
    number: 1,
    title: "Základní zásady",
    paragraphs: [
      "Peníze spolku jsou společné a slouží jen k účelu spolku podle čl. 1 až 3 stanov, zejména k podpoře členů. Žádné družstvo nemá nárok na podíl.",
      "Každý výdaj musí být doložen dokladem a zveřejněn podle čl. 5.",
    ],
  },
  {
    number: 2,
    title: "Potřeby členů a plán výdajů",
    paragraphs: [
      "Setkání TAP Spirit se koná zpravidla první středu v měsíci. Připadne-li na státní svátek nebo jí brání jiná překážka, určí předseda spolku náhradní termín.",
      "Družstva sdělují své potřeby předsedovi spolku průběžně, nejpozději na setkání TAP Spirit.",
      "Předseda spolku z nich sestaví plán výdajů na následující měsíc a představí jej na nejbližším setkání TAP Spirit. Strategické výdaje z plánu předloží ke schválení podle čl. 4.",
      "Pokud prostředky nestačí na všechny potřeby, dostanou přednost ty s největším přínosem pro členy a nejvyšší naléhavostí. Přednost vyhodnocuje předseda spolku.",
    ],
  },
  {
    number: 3,
    title: "Provozní výdaje",
    paragraphs: [
      "O provozních výdajích rozhoduje předseda spolku sám. Jsou to zpravidla jednorázové výdaje na provoz spolku a na podporu členů v souladu s účelem spolku (čl. 2 stanov), například kancelářské potřeby, vybavení, drobné služby nebo společné akce.",
      "Součet provozních výdajů za kalendářní měsíc nesmí přesáhnout 30 % členských příspěvků přijatých v předchozím měsíci. Nevyčerpaná částka se nepřevádí. Limit se počítá jen z členských příspěvků; dary, dotace a jiné příjmy jej nezvyšují. Příklad: 45 členů × 190 Kč = 8 550 Kč měsíčně, limit je tedy 2 565 Kč.",
      "Jeden nákup nelze dělit na menší, aby se vešel do limitu. Od družstva, které vykonává funkci předsedy spolku, nelze nakupovat jako provozní výdaj.",
    ],
  },
  {
    number: 4,
    title: "Strategické výdaje",
    paragraphs: [
      [
        "Strategickým výdajem je zejména:",
        "a) opakovaná platba nebo předplatné;",
        "b) financování komunitních rolí;",
        "c) rozpočet housu;",
        "d) výdaj hrazený z darů, dotací nebo jiných příjmů než členských příspěvků;",
        "e) každý jiný výdaj, který se nevejde do limitu podle čl. 3.",
      ].join("\n"),
      "Strategický výdaj musí předem schválit členská schůze hlasováním per rollam (čl. 13 stanov). Předseda spolku zašle družstvům návrh s uvedením předmětu, účelu, celkové ceny a doby trvání.",
      "Každé družstvo si o návrhu nejprve rozhodne uvnitř, podle pravidel hlasování svých stanov. S mandátem z tohoto rozhodnutí pak jeho statutární orgán hlasuje PRO, nebo PROTI.",
      "Každé družstvo má jeden hlas a lhůta je 7 dní. Kdo neodpoví, hlasuje proti. Výdaj je schválen, hlasuje-li pro něj nadpoloviční většina všech družstev (při čtyřech družstvech alespoň tři, při šesti alespoň čtyři).",
      "Schválení opakovaného výdaje platí po dobu uvedenou v návrhu, nejdéle 12 měsíců. Poté je nutné nové schválení.",
    ],
  },
  {
    number: 5,
    title: "Transparentnost a označení",
    paragraphs: [
      "Předseda spolku průběžně zapisuje do aplikace Tappka každý výdaj (datum, částku, účel a doklad) a stav účtu. Údaje jsou dostupné všem členům.",
      "Na každém setkání TAP Spirit předseda spolku shrne výdaje od předchozího setkání.",
      "Co je financováno z komunitní kasy, musí být takto označeno. Věci a vybavení se opatří štítkem, u akcí, komunitních rolí a výstupů se tato skutečnost uvede v jejich prezentaci a komunikaci, například textem „Financováno z komunitní kasy Spirit of TAP, z.s.“. Za označení odpovídá družstvo nebo osoba, která prostředky čerpá.",
    ],
  },
  {
    number: 6,
    title: "Závěrečná ustanovení",
    paragraphs: [
      "Výdaj uskutečněný v rozporu se směrnicí předloží předseda spolku dodatečně ke schválení podle čl. 4.",
      "Směrnici může změnit jen členská schůze.",
      "Směrnice nabývá účinnosti dnem schválení členskou schůzí (per rollam č. 3/2026).",
    ],
  },
];

export interface ExpenseKind {
  id: "provozni" | "strategicke";
  title: string;
  whoDecides: string;
  summary: string;
  examples: string[];
  rule: string;
}

export const EXPENSE_KINDS: [ExpenseKind, ExpenseKind] = [
  {
    id: "provozni",
    title: "Provozní výdaje",
    whoDecides: "Rozhoduje vedení spolku samo",
    summary: "Jednorázové nákupy pro chod spolku a podporu členů.",
    examples: ["kancelářské potřeby", "vybavení", "drobné služby", "společné akce"],
    rule: "Za měsíc nejvýš 30 % příspěvků z minulého měsíce.",
  },
  {
    id: "strategicke",
    title: "Strategické výdaje",
    whoDecides: "Schvalují družstva hlasováním",
    summary: "Opakované platby, komunitní role, rozpočty housů a vše nad limit.",
    examples: ["předplatné", "komunitní role", "rozpočet housu", "výdaje z darů"],
    rule: "Každé družstvo má jeden hlas, lhůta 7 dní. Kdo neodpoví, hlasuje proti. Rozhoduje většina všech družstev.",
  },
];

export interface CycleStep {
  title: string;
  description: string;
  icon: "users" | "clipboard-list" | "vote" | "receipt";
}

export const DECISION_CYCLE: CycleStep[] = [
  {
    title: "Družstva sdílí potřeby",
    description: "Na setkání TAP Spirit, zpravidla první středu v měsíci.",
    icon: "users",
  },
  {
    title: "Vedení spolku připraví plán",
    description: "Plán výdajů na další měsíc podle přínosu a naléhavosti.",
    icon: "clipboard-list",
  },
  {
    title: "Družstva hlasují o strategických výdajích",
    description: "Per rollam, jedno družstvo = jeden hlas, 7 dní.",
    icon: "vote",
  },
  {
    title: "Výdaj je vidět v Tappce a označený",
    description: "Každý výdaj má doklad a věci nesou značku kasy.",
    icon: "receipt",
  },
];

export interface OperationalLimitExample {
  members: number;
  contribution: number;
  percent: number;
}

export const OPERATIONAL_LIMIT_EXAMPLE: OperationalLimitExample = { members: 45, contribution: 190, percent: 30 };

export function operationalLimit({ members, contribution, percent }: OperationalLimitExample): number {
  return Math.round((members * contribution * percent) / 100);
}
