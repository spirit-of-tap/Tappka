/** Pravidla použití značky — zkrácený obsah manuálu (kapitoly 01–07). */

export const KASA_WHY_LABEL =
  "Co je zaplacené ze společných peněz, je vidět. Označená věc patří všem družstvům, ne tomu, kdo ji koupil nebo zrovna používá — a když jsou výsledky vidět, družstva snáz schválí další výdaje.";

export interface KasaPlacement {
  medium: string;
  rule: string;
}

export const KASA_PLACEMENTS: KasaPlacement[] = [
  { medium: "Věci a vybavení", rule: "Samolepka 60 × 25 mm hned po převzetí, na viditelné místo, které se neotírá ani nezahřívá." },
  { medium: "Textil", rule: "Tkaný štítek 40 × 15 mm, všitý do lemu nebo nažehlovací." },
  { medium: "Drobný materiál", rule: "Neoznačuje se kus po kuse — samolepka patří na krabici nebo stojánek." },
  { medium: "Komunitní role", rule: "Plakát v prostoru, kde role působí; role i v podpisu e-mailu a v profilu v Tappce." },
  { medium: "Prezentace", rule: "Odznak v pravém dolním rohu, výška asi 6 % slidu." },
  { medium: "Sociální sítě", rule: "Příspěvek 1080 × 1080 px a věta v popisku." },
  { medium: "Dokumenty", rule: "Sestava v zápatí vlevo, šířka 45 mm." },
  { medium: "E-mail", rule: "Jen věta pod podpisem, bez obrázku." },
];

export const KASA_PLACEMENT_OWNER = "Označí družstvo nebo osoba, která prostředky čerpá.";

export const KASA_SIZE_RULES = [
  { title: "Ochranná zóna", text: "Kolem značky nech volné místo o průměru středové mince." },
  { title: "Minimální velikost", text: "10 mm v tisku, 24 px na obrazovce." },
  { title: "S logem TAP", text: "Stojí-li vedle sebe, logo TAP je vlevo." },
] as const;

export const KASA_DONTS = [
  { id: "deformovat", label: "Nedeformovat" },
  { id: "barvy", label: "Neměnit barvy" },
  { id: "efekty", label: "Bez stínů a efektů" },
  { id: "otacet", label: "Neotáčet" },
] as const;

export const KASA_MEANING = [
  {
    title: "Segmenty jsou družstva",
    text: "Spolek počítá se šesti družstvy, proto má značka šest dílů, i když jich je zrovna méně.",
  },
  { title: "Mezery jsou samostatnost", text: "Každé družstvo zůstává vlastní firmou s vlastním rozhodováním." },
  {
    title: "Střed je kasa",
    text: "Mince, do které přispívají všichni a ze které se čerpá pro všechny. Je od každého segmentu stejně daleko, stejně jako má každé družstvo jeden hlas.",
  },
] as const;

export const KASA_PRINT_NOTE =
  "Před tiskem konzultuj s Brand House; pro tiskárnu převeď písmo v SVG na křivky. Značka vychází z písem brand manuálu Tiimiakatemia® Prague, logo TAP ale nenahrazuje.";
