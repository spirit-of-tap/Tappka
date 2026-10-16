/** Typy pro modul Komunitní kasa (transparentní účet RB, Spirit of TAP, z.s.). */

export interface RbTransaction {
  idTransaction: number;
  accountName: string;
  info: string;
  transactionType: string;
  accountNumber: string;
  amount: number;
  datum: string;
  realizationDate: string | null;
  valutaDate: string | null;
  varSymbol: string | null;
}

export interface RbTransactionListResponse {
  nextStartIndex: number;
  endOfRecords: boolean;
  transactions: RbTransaction[];
}

export interface KasaAccount {
  name: string;
  number: string;
  balance: number | null;
  currency: string;
}

export interface KasaResponse {
  account: KasaAccount;
  transactions: RbTransaction[];
  fetchedAt: string;
}

export interface StanovyArticle {
  number: number;
  title: string;
  paragraphs: string[];
}

export interface RejstrikInfo {
  nazev: string;
  spisovaZnacka: string;
  ico: string;
  formattedIco: string;
  pravniForma: string;
  datumVzniku: string;
  sidlo: string;
  puvodniSidlo: string;
  ucel: string;
  predmetHlavniCinnosti: string[];
  predmetVedlejsiCinnosti: string[];
  nejvyssiOrgan: string;
  statutarniOrgan: {
    typ: string;
    nazev: string;
    ico: string;
    sidlo: string;
    vznikFunkce: string;
    zastupuje: {
      jmeno: string;
      datumNarozeni: string;
      bydliste: string;
    };
    pocetClenu: number;
    zpusobJednani: string;
  };
  links: {
    rejstrik: string;
    sbirkaListin: string;
    transparentniUcet: string;
  };
}

export interface SbirkaListinDokument {
  id: "sl1" | "sl2" | "sl3";
  cislo: string;
  typ: string;
  datumVzniku: string;
  datumZapisu: string;
  stran: number;
  popis: string;
  url: string;
  pdfSoubor: string;
}

export interface UsneseniZapis {
  cislo: number;
  nazev: string;
  text: string;
  hlasovani: string;
}

export interface ZapisClenskeSchuze {
  datum: string;
  misto: string;
  zahajeni: string;
  ukonceni: string;
  pritomni: string[];
  pocetClenu: number;
  pritomnoClenu: number;
  predsedajici: string;
  zapisovatel: string;
  usneseni: UsneseniZapis[];
}

