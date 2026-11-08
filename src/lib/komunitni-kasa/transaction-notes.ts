/**
 * Popisky pohybů na transparentním účtu kasy.
 *
 * Banka u plateb kartou ukazuje jen „PK:408361XXXXXX7726 obchod; město“, takže
 * sem doplňujeme srozumitelný popis a kategorii. Jak přidat řádek:
 * 1. Najdi `idTransaction` pohybu (stránka „Všechny pohyby“ v Tappce nebo
 *    JSON z `/api/komunitni-kasa`).
 * 2. Přidej `<id>: { description: "…", category: TRANSACTION_CATEGORY.… }`.
 *
 * Kategorie: nakup (věci), sluzba (práce, faktury), proplaceni (náhrada
 * výdaje), vraceni (vrácení nevyčerpaných peněz družstvu),
 * prijem, jine. Pohyb bez popisku se zobrazí s textem z banky bez čísla karty.
 */

export const TRANSACTION_CATEGORY = {
  NAKUP: "nakup",
  SLUZBA: "sluzba",
  PROPLACENI: "proplaceni",
  VRACENI: "vraceni",
  PRIJEM: "prijem",
  JINE: "jine",
} as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORY)[keyof typeof TRANSACTION_CATEGORY];

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  nakup: "Nákup",
  sluzba: "Služba",
  proplaceni: "Proplacení",
  vraceni: "Vrácení družstvu",
  prijem: "Příjem",
  jine: "Ostatní",
};

export interface TransactionNote {
  description: string;
  category: TransactionCategory;
}

export const TRANSACTION_NOTES: Readonly<Record<number, TransactionNote>> = {
  9615689405: { description: "Vyklizení a reorganizace skladu", category: TRANSACTION_CATEGORY.SLUZBA },
  8496134238: {
    description: "Vrácení nevyčerpané části příspěvku (PAVIAAN)",
    category: TRANSACTION_CATEGORY.VRACENI,
  },
  8496132169: { description: "Vrácení nevyčerpané části příspěvku", category: TRANSACTION_CATEGORY.VRACENI },
  8287447039: { description: "Proplacení účtenky", category: TRANSACTION_CATEGORY.PROPLACENI },
  7784585443: { description: "Úhrada faktury č. 20250013", category: TRANSACTION_CATEGORY.SLUZBA },
};
