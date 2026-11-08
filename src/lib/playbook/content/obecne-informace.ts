import type { PlaybookChapter } from "../types";

export const OBECNE_INFORMACE: PlaybookChapter = {
  slug: "obecne-informace",
  title: "Obecné informace",
  lead:
    "Dokument slouží ke strukturovanému poskytnutí všech klíčových informací o Tiimiakatemia Prague, aby z něj kdokoliv mohl čerpat informace a best-practices k úspěšnému chodu, komunikaci a fungování Tiimiakatemia Prague.",
  sections: [
    {
      slug: "cil",
      title: "Cíl",
      blocks: [
        {
          kind: "paragraph",
          text: "Dokument slouží ke strukturovanému poskytnutí všech klíčových informací o Tiimiakatemia Prague, aby z něj kdokoliv mohl čerpat informace a best-practices k úspěšnému chodu, komunikaci a fungování Tiimiakatemia Prague.",
        },
      ],
    },
    {
      slug: "postup",
      title: "Postup",
      blocks: [
        {
          kind: "paragraph",
          text: "Dokument se skládá ze strukturovaných a logicky poskládaných procesů které již v Tiimiakatemia Prague vznikly a jsou průběžně aktualizovány v živých dokumentech (MS Word, Excel, Miro, Prezi, aj.). Na tyto procesy dokument odkazuje (jsou umístěny v jednotlivých záložkách/přílohách) a zároveň z nich čerpá klíčové informace.",
        },
        {
          kind: "paragraph",
          text: "Procesy se mnohdy vzájemně protkávají a odkazuje se na ně vícekrát pro jednotlivé klíčové osoby, dokument se zaměřuje aby tuto skutečnost co nejlépe zachytil a zjednodušil.",
        },
      ],
    },
    {
      slug: "klicove-osoby",
      title: "Klíčové osoby",
      blocks: [
        {
          kind: "paragraph",
          text: "Dokument popisuje a odkazuje na důležité procesy dle klíčových osob ve všech fázích cyklu Tiimiakatemia Prague.",
        },
        {
          kind: "list",
          ordered: false,
          items: [
            "UCHAZEČI & STUDENTI",
            "KOUČOVÉ/MENTOŘI (HEAD KOUČ, KOUČOVÉ, NOVÁČCI & ASISTENT KOUČI, MENTOŘI)",
            "VYUČUJÍCÍ & ZÁSTUPCI PEF/ČZU",
            "VEŘEJNOST (PARTNEŘI, ZÁKAZNÍCI, RODIČE, atd.)",
          ],
        },
      ],
    },
  ],
};
