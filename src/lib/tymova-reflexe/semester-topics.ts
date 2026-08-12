export type SemesterReflectionTopic =
  | "predmety_zkousky_vyucujici"
  | "metodika_a_metriky"
  | "kouci_a_mentori"
  | "tymy_a_tymove_spolecnosti"
  | "individualni_prinos"
  | "komunita"
  | "komunitni_role"
  | "komunitni_akce"
  | "komunitni_a_cross_projekty"
  | "zacleneni_tucnaku"
  | "dalsi"

export interface SemesterTopicDefinition {
  key: SemesterReflectionTopic
  label: string
  description: string
}

export const SEMESTER_REFLECTION_TOPICS: readonly SemesterTopicDefinition[] = [
  {
    key: "predmety_zkousky_vyucujici",
    label: "Předměty, zkoušky, vyučující",
    description:
      "Reflektujte na zadání předmětů, odsouhlasení kontraktu, práci na plnění podmínek předmětů, spolupráci a komunikaci s vyučujícím, zpracovávání dokumentů a jejich odevzdávání, proces zápočtů a zkoušek, praktický přínos předmětů, atd.",
  },
  {
    key: "metodika_a_metriky",
    label: "Metodika a metriky",
    description:
      "Reflektujte na dodržování metodiky, plnění metrik (případně jaké jsou důvody neplnění), přínos implementovaných nástrojů Tiimiakatemie, obecné chápání a interpretaci metodiky a vzájemné sjednocení v tomto směru, atd.",
  },
  {
    key: "kouci_a_mentori",
    label: "Kouči:ky, asistenti:ky kouče:ky a mentoři:ky",
    description:
      "Reflektujte na spolupráci a komunikaci se svým:ou týmovým:ou koučem:kou, jeho:její přínos vašemu týmu a týmové společnosti, reflektujte zároveň i spolupráci a komunikaci s ostatními kouči:kami a mentory:kami jednotlivě, popř. s týmem koučů:ek jako celkem, atd.",
  },
  {
    key: "tymy_a_tymove_spolecnosti",
    label: "Týmy a týmové společnosti",
    description:
      "Reflektujte fungování vašeho týmu, procesy a výsledky vašeho týmu a týmové společnosti za celý semestr (možné v porovnání s ostatními týmy), zavedené inovace ve vašem týmu a jejich dopad, týmový posun, použité kreativní techniky atd. Pro týmovou reflexi můžete využít sebehodnotící zprávy z ostatních záložek.",
  },
  {
    key: "individualni_prinos",
    label: "Individuální přínos v týmu",
    description:
      "Reflektujte na přínos jednotlivců, spolupráci a komunikaci s ostatními týmovými členy, rozvoj jednotlivců a jejich motivaci a disciplínu, fungování týmových rolí, atd.",
  },
  {
    key: "komunita",
    label: "Komunita",
    description:
      "Reflektujte na celkové fungování komunity, atmosféru a kulturu, reflektujte na ostatní týmy a týmové společnosti a komunikaci s nimi, celkovou informovanost v komunitě a sdílení informací, know-how, zkušeností a dalších, posun komunity jako učící se organizace, ochotu jednotlivců udržovat komunitu jako místo, kde se cítíme dobře, atd.",
  },
  {
    key: "komunitni_role",
    label: "Komunitní role",
    description:
      "Reflektujte na konkrétní přínos a výsledky téček v komunitních rolích, kompetence a zodpovědnosti jednotlivých rolí, s ohledem na aktuální potřeby komunity reflektujte, jak komunitní role pokrývají tyto potřeby (obecně role i konkrétní téčko v roli), reflektujte na TAP Spirit, atd.",
  },
  {
    key: "komunitni_akce",
    label: "Komunitní akce",
    description:
      "Reflektujte na komunitní akce jako především Rocket Days a HC, případně i další (learning circus a jiné výjezdy do zahraničí, Tiimiples, Sales Days, imatrikulace tučňáků a jiné), reflektujte na organizaci a přínos těchto akcí, atd.",
  },
  {
    key: "komunitni_a_cross_projekty",
    label: "Komunitní a cross projekty",
    description:
      "Reflektujte na konkrétní spolupráci v rámci komunity, celokomunitní BG, počet cross projektů a jejich výhody/nevýhody.",
  },
  {
    key: "zacleneni_tucnaku",
    label: "Začlenění tučňáků",
    description:
      "Reflektujte na onboardingový proces, tzn. začlenění tučňáků do stávající komunity, přijetí vize, mise, hodnot a principů TAPu, přijetí kultury a „nepsaných pravidel“, reflektujte na buddy systém a rental team leadry, atd.",
  },
  {
    key: "dalsi",
    label: "Další",
    description:
      "Reflektujte na cokoliv dalšího, co nepokrývají jednotlivé oblasti a myslíte si, že je důležité to zvědomit a měnit, případně je zde prostor pro spršku uznání jednotlivcům, skupinám, týmům, atd.",
  },
]
