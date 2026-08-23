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

export type RocnikovaReflectionTopic = SemesterReflectionTopic

export interface SemesterTopicDefinition {
  key: SemesterReflectionTopic
  label: string
  description: string
}

export type RocnikovaTopicDefinition = SemesterTopicDefinition

export const ROCNIKOVA_REFLECTION_TOPICS: readonly RocnikovaTopicDefinition[] = [
  {
    key: "predmety_zkousky_vyucujici",
    label: "Předměty, zkoušky, vyučující",
    description:
      "Reflektujte na zadání předmětů, odsouhlasení kontraktu, práci na plnění podmínek předmětů, spolupráci a komunikaci s vyučujícími, zpracovávání dokumentů a jejich odevzdávání, proces zápočtů a zkoušek, praktický přínos předmětů atd.",
  },
  {
    key: "metodika_a_metriky",
    label: "Metodika a metriky",
    description:
      "Reflektujte na dodržování metodiky, plnění metrik (případně jaké jsou důvody neplnění), přínos implementovaných nástrojů Tiimiakatemie, obecné chápání a interpretaci metodiky a vzájemné sjednocení v tomto směru atd.",
  },
  {
    key: "kouci_a_mentori",
    label: "Kouči:ky, asistenti:ky kouče:ky a mentoři:ky",
    description:
      "Reflektujte na spolupráci a komunikaci se svým:ou týmovým:ou koučem:kou, jeho:její přínos vašemu týmu a týmové společnosti, reflektujte zároveň i spolupráci a komunikaci s ostatními kouči:kami a mentory:kami jednotlivě, popř. s týmem koučů:ek jako celkem atd.",
  },
  {
    key: "tymy_a_tymove_spolecnosti",
    label: "Týmy a týmové společnosti",
    description:
      "Reflektujte fungování vašeho týmu, procesy a výsledky vašeho týmu a týmové společnosti za celý ročník (možné v porovnání s ostatními týmy), zavedené inovace ve vašem týmu a jejich dopad, týmový posun, použité kreativní techniky atd.",
  },
  {
    key: "individualni_prinos",
    label: "Individuální přínos v týmu",
    description:
      "Reflektujte na přínos jednotlivců, spolupráci a komunikaci s ostatními týmovými členy:kami, rozvoj jednotlivců a jejich motivaci a disciplínu, fungování týmových rolí atd.",
  },
  {
    key: "komunita",
    label: "Komunita",
    description:
      "Reflektujte na celkové fungování komunity, atmosféru a kulturu, reflektujte na ostatní týmy a týmové společnosti a komunikaci s nimi, celkovou informovanost v komunitě a sdílení informací, know-how, zkušeností, posun komunity jako učící se organizace, ochotu jednotlivců udržovat komunitu jako bezpečné a inspirativní místo atd.",
  },
  {
    key: "komunitni_role",
    label: "Komunitní role",
    description:
      "Reflektujte na konkrétní přínos a výsledky studujících v komunitních rolích, kompetence a zodpovědnosti jednotlivých rolí, jak komunitní role pokrývají aktuální potřeby komunity, a reflektujte na TAP Spirit.",
  },
  {
    key: "komunitni_akce",
    label: "Komunitní akce",
    description:
      "Reflektujte na komunitní akce, především Rocket Days a Houston Calling, případně i další (learning circus a výjezdy do zahraničí, Tiimiples, Sales Days, imatrikulace tučňáků), reflektujte na organizaci a přínos těchto akcí atd.",
  },
  {
    key: "komunitni_a_cross_projekty",
    label: "Komunitní a cross projekty",
    description:
      "Reflektujte na spolupráci v rámci komunity, celokomunitní projekty, počet cross-projektů a jejich přínosy i výzvy.",
  },
  {
    key: "zacleneni_tucnaku",
    label: "Začlenění tučňáků",
    description:
      "Reflektujte na onboardingový proces, začlenění tučňáků do stávající komunity, přijetí vize, mise, hodnot a principů TAPu, přijetí kultury a „nepsaných pravidel“, buddy systém a rental team leadery:ky.",
  },
  {
    key: "dalsi",
    label: "Další",
    description:
      "Reflektujte na cokoliv dalšího, co nepokrývají jednotlivé oblasti a je důležité to zvědomit a pojmenovat, případně zde vyjádřete uznání jednotlivcům, skupinám a týmům.",
  },
]

export const SEMESTER_REFLECTION_TOPICS = ROCNIKOVA_REFLECTION_TOPICS
