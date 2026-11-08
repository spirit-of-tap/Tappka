import type { PlaybookChapter } from "../types";

export const KOMUNIKACNI_STRUKTURA: PlaybookChapter = {
  slug: "komunikacni-struktura",
  title: "Komunikační struktura",
  sections: [
    {
      slug: "komunikacni-tok",
      title: "Komunikační tok",
      blocks: [
        {
          kind: "paragraph",
          text: "Důležitým odrazovým můstkem je komunikační struktura Tiimiakatemia Prague. Je důležitá pro všechny klíčové osoby pro pochopení a čerpání informací, které často probíhají ústní formou a mohou být v průběhu akademického roku často tak dynamické, že je psané procesy nemusí včas zachytit a aktualizace může proběhnout až později.",
        },
        {
          kind: "note",
          text: "Klíčovou osobou je pro tuto oblast Chief Information Officer (CIO)",
        },
      ],
    },
    {
      slug: "ms-teams",
      title: "MS Teams",
      blocks: [
        {
          kind: "paragraph",
          text: "Základní komunikační a informační platformou jsou MS Teams, kde probíhají veškerá klíčová oznámení, sdílejí se a nahrávají důležité dokumenty, které jsou ukládány do strukturovaných složek.",
        },
        {
          kind: "paragraph",
          text: "V současné době existuje několik veřejných komunikačních kanálů, které obsahují i důležité dokumenty ve složkách. Do těchto kanálů je přidán každý člen Tiimi komunity.",
        },
        {
          kind: "list",
          ordered: false,
          items: [
            "General (obecné sdělení, oznámení komunitě)",
            "Akce (ZN, HC, RD) (pozvánky na interní i externí akce, tipy na zajímavé události)",
            "Ocenění (prostor pro pochvaly a uznání)",
            "Reading, odkazy, inspirace, zkoušky (vše o čtení, esej bance, knihovny TAP, Book of Books)",
            "Sdělení koučů (informace od head kouče, koučů, mentorů směr komunita)",
            "Změny, inovace, návrhy na TLF (informace o inovacích které zlepšují nástroje/komunitu)",
            "Marketing PR (informace o marketingu Tiimi, kampaních, partnerství, soutěžích, brandovém manuálu;, v dokumentech jsou k dispozici loga, prezentace, letáky a další materiály)",
            "TAP SPIRIT (informace týkající se jednotlivých členů TAP Spirit / Housů, schůzky)",
            "NEWSLETTER - týdenní souhrn informací z TAPu.",
            "HelpDesk IT House – prostor pro připomínky a dotazy ohledně IT House",
          ],
        },
        {
          kind: "paragraph",
          text: "Každý tým studentů, skupina koučů a mentorů, jednotlivé studentské housy, vyučující (a další) si zpravidla zakládají svůj neveřejný (zamčený) komunikační kanál, kde společně komunikují a ukládají si do své složky vzniklé dokumenty.",
        },
        {
          kind: "list",
          ordered: false,
          items: [
            "V rámci onboardingu pravidelně probíhá školení na MS Teams pro studenty organizované CIO, případně jejich buddy.",
            "Pro nové kouče se o školení stará buddy.",
          ],
        },
      ],
    },
  ],
};
