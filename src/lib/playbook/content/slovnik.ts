import type { PlaybookChapter } from "../types";

export const SLOVNIK: PlaybookChapter = {
  slug: "slovnik",
  title: "Slovník TAP",
  sections: [
    {
      slug: "uvod",
      title: "Slovník TAP",
      blocks: [
        {
          kind: "paragraph",
          text: "Pojmy vychází z toho, jak je vnímají Téčka. Jsou doplněny některé další pojmy podstatné pro práci kouče v TAPu.",
        },
      ],
    },
    {
      slug: "a",
      title: "A",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            // Digit-first terms ("360° …") collate before letters — placed in A.
            [
              "360° zpětná vazba",
              "Hodnocení činnosti člověka různými osobami, tedy z různých úhlů → objektivní hodnocení.",
            ],
            [
              "AAR",
              "After action review, poprojektová fáze, reflexe.",
            ],
            [
              "Account manager",
              "Je zodpovědný za externí komunikaci, tvorbu webu a o celkovou image firmy.",
            ],
            [
              "ATP",
              "Applying theory to practice. Metoda používaná pro převedení nastudované teorie do praxe. Způsob učení v Tiimi.",
            ],
          ],
        },
      ],
    },
    {
      slug: "b",
      title: "B",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Banka esejí",
              "Databáze kam všichni studenti nahrávají své eseje o knihách.",
            ],
            [
              "Belbinovy role",
              "Ukazují, jaké typy a vlastnosti musí být obsaženy v efektivním týmu. Jsou založeny na osobnostních rysech, ale mohou se měnit v různých týmech/projektech.",
            ],
            [
              "Birth giving (BGčko)",
              "BG je řešení problému externí firmy v časovém limitu nejčastěji 4-24h. BG jsou buď celokomunitní nebo týmové.",
            ],
            [
              "Book of books (BoB)",
              "Seznam knih doporučených ke studiu",
            ],
            [
              "Business meeting",
              "Týmové schůzky, které si tým stanoví. Řeší se na nich třeba finance, realizace nápadů nebo akční kroky z TS.",
            ],
          ],
        },
      ],
    },
    {
      slug: "c",
      title: "C",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Cabin in the woods",
              "Teambuilding mimo prostory TAP",
            ],
            [
              "Check-in",
              "Přihlášení do začátku training session, slouží k informování ostatních. S čím přicházíme.",
            ],
            [
              "Check-out",
              "Odhlášení z training session. S čím odcházíme.",
            ],
            [
              "Communication manager",
              "Je zodpovědný za interní komunikaci v organizaci, spravuje týmový kalendář a účastní se fóra komunikačních manažerů.",
            ],
            [
              "Crossfertilizace (Cross)",
              "Je účast na training session jiného týmu. Slouží k získání nových perspektiv, nahlédnutí do fungování cizího týmu, a i k obohacení daného TSka.",
            ],
          ],
        },
      ],
    },
    {
      slug: "d",
      title: "D",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Days of Joy",
              "Dny během zkouškového",
            ],
            [
              "Dialog",
              "Tvoří základ našeho učení, způsob komunikace. Je to volné a tvořivé prozkoumávání, je důležité při něm ustoupit svému egu a naslouchat druhým. V dialogu existují 4 role, které by měli být obsaženy pro jeho správné fungování. Využívá se pro generování nových myšlenek.",
            ],
            [
              "Diskuze",
              "Soutěž, kde vítěz bere vše. Forma komunikace, při které jsou obhajovány názory.",
            ],
          ],
        },
      ],
    },
    {
      slug: "f",
      title: "F",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Financial manager (finančák)",
              "Je zodpovědný za finance a účetnictví v rámci družstva nebo jednotlivého projektu.",
            ],
            [
              "Forest & back",
              "Akce pořádaná na začátku studia v TA pro první ročník. Pořádají ji vyšší ročníky.",
            ],
          ],
        },
      ],
    },
    {
      slug: "h",
      title: "H",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Houston calling (HáCéčko, HC)",
              "Celokomunitní akce konající první středu v měsíci. Týmy zde prezentují svůj posun za poslední měsíc.",
            ],
          ],
        },
      ],
    },
    {
      slug: "k",
      title: "K",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Kouč",
              "Člověk, který není součástí týmu, ale dohlíží na jeho rozvoj a vzdělávání se.",
            ],
            [
              "Koučování",
              "Metoda vzdělávání založená na rozvíjení člověka druhou osobou koučem – průvodce.",
            ],
          ],
        },
      ],
    },
    {
      slug: "l",
      title: "L",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Leader",
              "Ukazuje ostatním cestu a pomáhá jim skrz pozitivní podněty. Je to vedoucí osoba, která pomáhá ostatním růst a rozvíjet se. Zajímá se o PROČ ostatních, začíná od sebe a motivuje druhé. Tým je tak dobrý jako jeho lídr.",
            ],
            [
              "Learning circus",
              "Akce pořádaná teamprenery jednou za rok. Cesta do předem zvolené destinace bez použití letecké dopravy.",
            ],
            [
              "Learning contract",
              "Smlouva sama se sebou, učící plán na určité období (většinou na 1 semestr)",
            ],
            [
              "Learning contract",
              "Teampreneur si ho vytváří sám na základě vlastního uvážení. Je složen z 5 základních otázek, které navrhují určitou strukturu, která by měla být naplněna. Kde jsem byl? Kde jsem teď? Kam se chci dostat? Jak se tam dostanu? Jak poznám, že jsem se tam dostal? Dovednosti, které v něm rozvíjíme by měli být v souladu s naším skill profilem.",
            ],
            [
              "Learning diary",
              "Deník, do kterého si Teampreneur zapisuje své poznatky z TS, z projektů nebo třeba z knih. Je to nástroj pro vzdělávání. Vede si ho každý člen týmu.",
            ],
          ],
        },
      ],
    },
    {
      slug: "m",
      title: "M",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Management group",
              "Skládá se ze 4 rolí, teamleader, finanční komunikační a account manažer. Podílí se na chodu týmu a tvoří jeho strukturu.",
            ],
            [
              "Mentální modely",
              "Vnitřní představy o světě, které nám pomáhají chápat a interpretovat realitu. Jsou to naše myšlenkové struktury a přesvědčení o tom, jak věci fungují, na jejichž základě se rozhodujeme a jednáme. V týmu se mentální modely mohou lišit, což ovlivňuje spolupráci a komunikaci. Proto je důležité je sdílet, reflektovat a společně rozvíjet, aby tým dosáhl lepšího porozumění a efektivity.",
            ],
            [
              "Metanoia",
              "Hluboká změna v myšlení a vnímání, která vede k transformaci jednotlivce nebo týmu. Je to proces, kdy člověk nebo skupina začíná vidět svět jinýma očima, což umožňuje nové způsoby učení, rozhodování a spolupráce. V kontextu týmového učení je metanoia klíčovým krokem k hlubšímu porozumění a dosažení trvalé změny v chování a postojích.",
            ],
          ],
        },
      ],
    },
    {
      slug: "p",
      title: "P",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Postmotorola",
              "Sada otázek k reflexi na projekt.",
            ],
            [
              "Premotorola",
              "Sada otázek před projektem, abychom si ujasnili jeho význam v našem učení.",
            ],
            [
              "Project manager",
              "Zodpovídá za chod projektu a rozvoj projektového týmu.",
            ],
          ],
        },
      ],
    },
    {
      slug: "r",
      title: "R",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Reading programme",
              "Seznam knížek, které si chci přečíst a mají návaznost na můj skill profile, learning contract a projekty.",
            ],
            [
              "Rental teamleader",
              "Je pronajatý teamleader na neurčitou dobu na počátku studia (většinou do konce semestru - ukončení zkoušet max.) a je zodpovědný za akceleraci vzdělání, pomoc se založením týmové společnosti a zvolení nového leadera)",
            ],
            [
              "Rocket days",
              "Komunitní akce, která probíhá 1x za půl roku. Jejím účelem by mělo být vyhodnocování vývoje komunity, utužování vztahů a dobrá zábava.",
            ],
            [
              "Rocket model",
              "Je založený na principech učící se organizace, osnova Tiimi.",
            ],
          ],
        },
      ],
    },
    {
      slug: "s",
      title: "S",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "SECI model",
              "Socializace, externalizace, combinace, internalizace. Model tvoření znalostí. Podporující dialog, týmové a individuální učení. Pracuje s tacitní a explicitní znalostí. Je to neustále se opakující smyčka. Základem je learning by doing, který tacitní znalosti převádí do explicitních a díky němuž vznikají další tacitní znalosti.",
            ],
            [
              "Skill profile",
              "Soubor 21 dovedností, které v rámci programu inovativní podnikání máme během svého studia dosáhnout na určité úrovni. Vyplňuje se jednou za semestr a funguje na principu 360° zpětné vazby. Jsem ohodnocen sám sebou, koučem, zákazníkem a 2 Téčky. Každá dovednost má 5 úrovní.",
            ],
            [
              "Skupina",
              "Lidé spojeni za účelem práce, ale bez společné vize.",
            ],
            [
              "Sticker",
              "Milníky v Rocket modelu, ocenění, které získáváme svou činností v týmu a v TAPu.",
            ],
          ],
        },
      ],
    },
    {
      slug: "t",
      title: "T",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "TAP",
              "Team Academy Prague",
            ],
            [
              "TEAM",
              "Together Everyone Achieves More, skupina lidí jdoucí si za stejným cílem, vizí. Členové se vzájemně doplňují ve svých dovednostech a přebírají odpovědnost sami za sebe. Mají vnitřní motivaci a důvěru. Jsou různé fáze vývoje týmu.",
            ],
            [
              "Team contract",
              "Smlouva pro oprávněnou buzeraci, týmová smlouva v rámci níž jsou vypsané pravidla, zásady podle kterými se tým řídí. Vzniká na základě společné domluvy nejlépe formou dialogu a musí s ní souhlasit všichni členové týmu.",
            ],
            [
              "Téčko / Teampreneur /Tčko",
              "Student Team Academy, stáváme se jím po úspěšném založení týmové společnosti.",
            ],
            [
              "TRP",
              "Training, reading, practice. Základní pilíře vzdělávání v TAPu.",
            ],
            [
              "Tučňák",
              "Student Team Academy v prvním ročníku, do založení týmové společnosti.",
            ],
            [
              "Tuleň",
              "",
            ],
            [
              "Týmová role",
              "Pozice, ve které člen týmu zastává určitá práva a povinnosti v týmu - má určitý soubor vlastností a dovedností.",
            ],
          ],
        },
      ],
    },
    {
      slug: "u",
      title: "U",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Učící se organizace",
              "Organizace, která neustále zlepšuje své procesy a schopnosti prostřednictvím kolektivního učení. Lidé v ní aktivně sdílejí znalosti, vzájemně se učí a neustále se přizpůsobují změnám. Každý člen přebírá odpovědnost za své učení a přispívá ke společnému růstu.",
            ],
          ],
        },
      ],
    },
    {
      slug: "v",
      title: "V",
      blocks: [
        {
          kind: "table",
          headers: ["Pojem", "Význam"],
          rows: [
            [
              "Vize",
              "Je představa budoucnosti, která udává směr.",
            ],
          ],
        },
      ],
    },
  ],
};
