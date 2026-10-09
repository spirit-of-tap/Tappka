import { describe, expect, it } from "vitest";

import {
  PLATNE_STANOVY_2026,
  SBIRKA_LISTIN_DOKUMENTY,
  SPOLOK_REJSTRIK_INFO,
  ZAPIS_CLENSKE_SCHUZE_2026,
} from "./stanovy-data";

describe("stanovy-data", () => {
  it("exports valid obchodní rejstřík metadata", () => {
    expect(SPOLOK_REJSTRIK_INFO.nazev).toBe("Spirit of TAP, z.s.");
    expect(SPOLOK_REJSTRIK_INFO.ico).toBe("23152036");
    expect(SPOLOK_REJSTRIK_INFO.formattedIco).toBe("231 52 036");
    expect(SPOLOK_REJSTRIK_INFO.sidlo).toContain("Chomutov");
    expect(SPOLOK_REJSTRIK_INFO.statutarniOrgan.nazev).toBe("Tuuli Co. Družstvo");
    expect(SPOLOK_REJSTRIK_INFO.statutarniOrgan.zastupuje.jmeno).toBe("Julie Holá");
    expect(SPOLOK_REJSTRIK_INFO.predmetHlavniCinnosti).toHaveLength(7);
    expect(SPOLOK_REJSTRIK_INFO.predmetVedlejsiCinnosti).toHaveLength(7);
    expect(SPOLOK_REJSTRIK_INFO.links.rejstrik).toContain("or.justice.cz");
    expect(SPOLOK_REJSTRIK_INFO.links.sbirkaListin).toContain("or.justice.cz");
    expect(SPOLOK_REJSTRIK_INFO.links.transparentniUcet).toContain("rb.cz");
  });

  it("exports all 16 articles of platné stanovy 2026", () => {
    expect(PLATNE_STANOVY_2026).toHaveLength(16);
    PLATNE_STANOVY_2026.forEach((article, index) => {
      expect(article.number).toBe(index + 1);
      expect(article.title.length).toBeGreaterThan(0);
      expect(article.paragraphs.length).toBeGreaterThan(0);
    });
    expect(PLATNE_STANOVY_2026[0].title).toBe("Základní ustanovení");
    expect(PLATNE_STANOVY_2026[15].title).toBe("Závěrečná ustanovení");
  });

  it("exports all 3 digitized documents from sbírka listin", () => {
    expect(SBIRKA_LISTIN_DOKUMENTY).toHaveLength(3);
    const ids = SBIRKA_LISTIN_DOKUMENTY.map((d) => d.id);
    expect(ids).toEqual(["sl3", "sl2", "sl1"]);
    SBIRKA_LISTIN_DOKUMENTY.forEach((doc) => {
      expect(doc.cislo).toContain("MSPH");
      expect(doc.url).toContain("or.justice.cz");
      expect(doc.stran).toBeGreaterThan(0);
    });
  });

  it("exports complete zápis z členské schůze 2026", () => {
    expect(ZAPIS_CLENSKE_SCHUZE_2026.datum).toContain("3. června 2026");
    expect(ZAPIS_CLENSKE_SCHUZE_2026.pritomni).toHaveLength(3);
    expect(ZAPIS_CLENSKE_SCHUZE_2026.usneseni).toHaveLength(4);
    expect(ZAPIS_CLENSKE_SCHUZE_2026.usneseni[0].nazev).toBe("Změna sídla spolku");
    expect(ZAPIS_CLENSKE_SCHUZE_2026.usneseni[1].nazev).toBe("Nové úplné znění stanov");
    expect(ZAPIS_CLENSKE_SCHUZE_2026.usneseni[2].nazev).toBe(
      "Přijetí právnické osoby za řádného člena",
    );
    expect(ZAPIS_CLENSKE_SCHUZE_2026.usneseni[3].nazev).toBe("Volba předsedy spolku");
  });
});
