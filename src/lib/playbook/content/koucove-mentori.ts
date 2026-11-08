import type { PlaybookChapter } from "../types";

export const KOUCOVE_MENTORI: PlaybookChapter = {
  slug: "koucove-mentori",
  title: "Koučové & mentoři",
  sections: [
    {
      slug: "komunikacni-nastroje",
      title: "Komunikační nástroje",
      blocks: [
        {
          kind: "paragraph",
          text: "Koučové mají specifickou roli v rámci komunikačního toku napříč Tiimiakatemia Prague - pro detaily klikni zde.",
        },
        {
          kind: "paragraph",
          text: "Komunikační tým na MS Teams “Team Coaches” - uzavřený kanál pro kouče a mentory - zde probíhá hlavní výměna informací a obsahuje kanály se všemi důležitými dokumenty.",
        },
        {
          kind: "paragraph",
          text: "K pravidelnému setkávání koučů a vzájemnému sdílení, vzdělávání a rozvoji komunity slouží Team Coaches Forum (TCF). Každý semestr probíhá strategická schůze koučů a mentorů, kde je cílem připomenutí strategickcýh cílů a rozebrání dílčích akčních kroků pro jejich postupné plnění.",
        },
      ],
    },
    {
      slug: "onboarding-noveho-kouce",
      title: "Onboarding nového kouče",
      blocks: [
        {
          kind: "paragraph",
          // The PDF source duplicates this sentence verbatim (copy-paste error
          // in the original document) — kept once.
          text: "K hladšímu onboardingu nového kouče slouží ucelený Průvodce, který slouží jako přehled základních oblastí a sfér působení kouče v komunitě TAPu. Nastupující kouč má také svého Buddyho, který mu pomáhá v prvních měsících jeho adaptace.",
        },
        {
          kind: "note",
          text: "Obsahuje informace o historii Tiimi, Leading Thoughts (vize, mise, hodnoty), budování učící se organizace, rozvíjené kompetence, jak se pracuje v Tiimi, Learning Contract, spolupráce s vyučujícími, odborná portfolia, role a zodpovědnosti kouče, pravidelné aktivity a jejich podrobný popis, klíčové principy a nástroje týmového učení, harmonogram roku, doporučenou literaturu a slovníček pojmů.",
        },
      ],
    },
    {
      slug: "role-a-odpovednosti-kouce",
      title: "Role a odpovědnosti kouče",
      blocks: [
        {
          kind: "paragraph",
          text: "Role a odpovědnost kouče v Tiimiakatemia Prague vychází z formátu popisu role z Team Coaches Best Tools. Týmový kouč má za úkol identifikovat a rozvíjet celkový potenciál jednotlivců, týmů a komunity prostřednictvím využívání koučování a dalších metod a nástrojů rozvoje. Kouč podporuje rozvoj týmů a jednotlivců v různých fázích jejich vývoje, učení a zlepšování výkonu. Cílem je vytvářet prostředí, které umožňuje Teamprenéům učit se prací na reálných projektech, a přinášet pozitivní změny do společnosti nebo také vychází z formy Competency Hands.",
        },
        {
          kind: "note",
          text: "Obsahuje účel role kouče, požadované dovednosti, odpovědnosti, účast na pravidelných aktivitách, check-list a Learning Contract.",
        },
      ],
    },
    {
      slug: "learning-contract-pro-kouce",
      title: "Learning Contract (pro kouče)",
      blocks: [
        {
          kind: "paragraph",
          text: "Vychází z Team Coaches Best Tools, zachycuje cíle na aktuální semestr každého kouče. Learning contract kouče by měl být hotov ideálně začátku semestru. Je doporučeno se k němu pravidelně vracet v rámci 1v1 setkáních 1x měsíčně.",
        },
        {
          kind: "note",
          text: "Oblasti Learning Contractu:",
        },
        {
          kind: "list",
          ordered: false,
          items: [
            "Kde jsem byl?",
            "Kde jsem teď?",
            "Kam směřuji a jak poznám že tam jsem?",
          ],
        },
        {
          kind: "list",
          ordered: false,
          items: ["Tým studentů", "Tým koučů", "Já"],
        },
      ],
    },
    {
      slug: "hodnotici-standardy-pro-kouce-the-team-coachs-best-tools",
      title: "Hodnotící standardy pro kouče (The Team Coachs Best Tools)",
      blocks: [
        {
          kind: "paragraph",
          text: "Tyto standardy slouží jako nástroj pro sledování a hodnocení výkonu kouče ze strany jeho týmu. Na základě zpětné vazby od týmu může kouč získat přehled o své aktuální úrovni kompetencí a v rámci Learning Contract si naplánovat jejich další rozvoj. Standardy jsou součástí Rocket modelu a jsou následující:",
        },
        {
          kind: "list",
          ordered: true,
          items: [
            "Náš týmový kouč ví jak naslouchat a povzbuzovat. Inspiruje nás a je upřímný a férový.",
            "Náš týmový kouč s námi prošel fází pseudotýmu.",
            "Náš týmový kouč zná silné a slabé stránky týmové společnosti, týmu a jednotlivých členů a pomohl nám pochopit sílu diverzity.",
            "Náš týmový kouč zná své mantinely a nesnaží se vést tým. Neslouží jako terapeut.",
            "Náš týmový kouč je vždy přítomný na training session, mentálně i fyzicky. Na TS je připraven a chodí včas.",
            "Náš týmový kouč podporuje profesionální rozvoj teamprenérů.",
            "Náš týmový kouč se posunul na vnějšího konzultanta, který pomáhá rozvynout náš byznys.",
            "Náš týmový kouč je Wonder-koučem komunity.",
          ],
        },
      ],
    },
    {
      slug: "spoluprace-koucu-s-vyucujicimi",
      title: "Spolupráce koučů s vyučujícími",
      blocks: [
        {
          kind: "paragraph",
          text: "Spolupráce mezi kouči a vyučujícími je klíčová pro úspěšný rozvoj týmů a jednotlivců. Kouč podporuje tým v jejich vzdělávacím procesu a zároveň zajišťuje, aby byl tým v souladu s požadavky jednotlivých předmětů. Pravidelné setkávání a sdílení zpětné vazby s vyučujícími umožňuje koučům lépe pochopit výzvy týmu a efektivněji je vést k dosažení cílů.",
        },
        {
          kind: "list",
          ordered: false,
          items: [
            "Před začátkem semestru probíhá společná příprava koučů a vyučujících.",
            "Kouč se na začátku semestru seznámí se zadáním předmětů svého týmu přes Learning manažera.",
            "Kouč se účastní schůzky k Odsouhlasení kontraktu, kde podporuje komunikací a vzájemné pochopení mezi téčky a vyučujícím.",
            "Kouč každý měsíc při plánovacím a reflektujícím TS vytvoří prostor na zvědomění, jak si tým stojí vůči plnění požadavků z předmětů a zda je pro následující měsíc na to v harmonogramu vytvořen prostor.",
            "Každý měsíc kouči sdílejí stav svých týmů na Team Coaches Foru (TCF) a dohodnou se na případné intervenci.",
            "Kouč je v kontaktu s aktuálními vyučujícími a minimálně jednou za semestr se ideálně osobně, nebo emailem doptá vyučujících, zda je vše v pořádku.",
            "Na konci semestru kouč sleduje plnění předmětů během týmové zkoušky nebo skrze Learning manažera.",
          ],
        },
      ],
    },
  ],
};
