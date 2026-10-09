"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  FileText,
  Landmark,
  Scale,
  ScrollText,
  Search,
  UserCheck,
} from "lucide-react";

import {
  PLATNE_STANOVY_2026,
  SBIRKA_LISTIN_DOKUMENTY,
  SPOLOK_REJSTRIK_INFO,
  ZAPIS_CLENSKE_SCHUZE_2026,
} from "@/lib/komunitni-kasa/stanovy-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function StanovyView() {
  const [activeTab, setActiveTab] = useState("stanovy");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedArticles, setExpandedArticles] = useState<Record<number, boolean>>(() => {
    // Default: expand first 3 articles
    return { 1: true, 2: true, 3: true };
  });

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return PLATNE_STANOVY_2026;
    return PLATNE_STANOVY_2026.filter((art) => {
      const matchTitle = art.title.toLowerCase().includes(q);
      const matchNum = String(art.number) === q;
      const matchContent = art.paragraphs.some((p) => p.toLowerCase().includes(q));
      return matchTitle || matchNum || matchContent;
    });
  }, [searchQuery]);

  const toggleArticle = (num: number) => {
    setExpandedArticles((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    PLATNE_STANOVY_2026.forEach((a) => {
      all[a.number] = true;
    });
    setExpandedArticles(all);
  };

  const collapseAll = () => {
    setExpandedArticles({});
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview Top Card */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-2 text-sm">
              <Landmark className="size-4 text-muted-foreground" aria-hidden />
              <strong className="font-semibold">{SPOLOK_REJSTRIK_INFO.nazev}</strong>
            </span>
            <span className="font-mono text-xs sm:text-sm text-muted-foreground">
              IČO: {SPOLOK_REJSTRIK_INFO.formattedIco}
            </span>
            <Badge variant="secondary" className="text-xs">
              Spisová značka: {SPOLOK_REJSTRIK_INFO.spisovaZnacka}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs sm:text-sm">
              <a
                href={SPOLOK_REJSTRIK_INFO.links.rejstrik}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                <span>Veřejný rejstřík</span>
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs sm:text-sm">
              <a
                href={SPOLOK_REJSTRIK_INFO.links.sbirkaListin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ScrollText className="size-3.5" aria-hidden />
                <span>Sbírka listin</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="stanovy" className="gap-1.5">
            <ScrollText className="size-4" aria-hidden />
            <span>Platné stanovy (2026)</span>
          </TabsTrigger>
          <TabsTrigger value="rejstrik" className="gap-1.5">
            <Scale className="size-4" aria-hidden />
            <span>Výpis z rejstříku</span>
          </TabsTrigger>
          <TabsTrigger value="listiny" className="gap-1.5">
            <FileText className="size-4" aria-hidden />
            <span>Sbírka listin & zápis</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: STANOVY */}
        <TabsContent value="stanovy" className="space-y-4 pt-1">
          <Card>
            <CardHeader className="p-3.5 sm:p-5 pb-2 sm:pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <FileCheck2 className="size-5 text-primary" aria-hidden />
                    Úplné znění stanov spolku
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm mt-0.5">
                    Schváleno členskou schůzí dne 3. 6. 2026 · Účinnost od zápisu do spolkového rejstříku
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll} className="h-8 text-xs">
                    Rozbalit vše
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll} className="h-8 text-xs">
                    Sbalit vše
                  </Button>
                </div>
              </div>
              <div className="relative pt-2">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Hledej v textu stanov (členství, zisk, předseda, příspěvky...)"
                  className="pl-9 text-xs sm:text-sm"
                  aria-label="Hledat v textu stanov"
                />
              </div>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-5 pt-0 sm:pt-0 space-y-3">
              {filteredArticles.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenalezen žádný článek odpovídající hledání „{searchQuery}“.
                </p>
              ) : (
                filteredArticles.map((art) => {
                  const isExpanded = expandedArticles[art.number] ?? false;
                  return (
                    <div
                      key={art.number}
                      className="rounded-lg border bg-card/60 transition-colors hover:bg-card"
                    >
                      <button
                        type="button"
                        onClick={() => toggleArticle(art.number)}
                        className="flex w-full items-center justify-between gap-3 p-3 sm:p-4 text-left font-medium"
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-foreground">
                            {art.number}
                          </span>
                          <span className="text-sm sm:text-base font-semibold truncate">
                            Čl. {art.number} · {art.title}
                          </span>
                        </div>
                        <span className="shrink-0 text-muted-foreground" aria-hidden>
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="border-t px-3.5 py-3 sm:px-4 sm:py-3.5 space-y-2 text-xs sm:text-sm leading-relaxed text-foreground">
                          {art.paragraphs.map((p, idx) => (
                            <p key={idx} className="whitespace-pre-line">
                              {p}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: REJSTRIK */}
        <TabsContent value="rejstrik" className="space-y-4 pt-1">
          <div className="grid gap-3.5 sm:gap-4 md:grid-cols-2">
            {/* Základní identifikační údaje */}
            <Card>
              <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden />
                  Základní identifikační údaje
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-4 pt-0 sm:pt-0 space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Název:</span>
                  <span className="font-semibold text-right">{SPOLOK_REJSTRIK_INFO.nazev}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">IČO:</span>
                  <span className="font-mono font-semibold tabular-nums text-right">
                    {SPOLOK_REJSTRIK_INFO.formattedIco}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Právní forma:</span>
                  <span className="text-right">{SPOLOK_REJSTRIK_INFO.pravniForma}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Spisová značka:</span>
                  <span className="text-right">{SPOLOK_REJSTRIK_INFO.spisovaZnacka}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Datum zápisu:</span>
                  <span className="text-right">{SPOLOK_REJSTRIK_INFO.datumVzniku}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Aktuální sídlo:</span>
                  <span className="font-medium text-right">{SPOLOK_REJSTRIK_INFO.sidlo}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-muted-foreground">Původní sídlo:</span>
                  <span className="text-muted-foreground text-right">
                    {SPOLOK_REJSTRIK_INFO.puvodniSidlo}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Statutární orgán */}
            <Card>
              <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <UserCheck className="size-4 text-muted-foreground" aria-hidden />
                  Statutární orgán — předseda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-4 pt-0 sm:pt-0 space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Typ orgánu:</span>
                  <span className="font-semibold text-right">
                    {SPOLOK_REJSTRIK_INFO.statutarniOrgan.typ}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Právnická osoba:</span>
                  <span className="font-semibold text-right">
                    {SPOLOK_REJSTRIK_INFO.statutarniOrgan.nazev} (IČO:{" "}
                    {SPOLOK_REJSTRIK_INFO.statutarniOrgan.ico})
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Sídlo předsedy:</span>
                  <span className="text-right">{SPOLOK_REJSTRIK_INFO.statutarniOrgan.sidlo}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Vznik funkce:</span>
                  <span className="text-right">{SPOLOK_REJSTRIK_INFO.statutarniOrgan.vznikFunkce}</span>
                </div>
                <div className="flex justify-between border-b pb-1.5">
                  <span className="text-muted-foreground">Při výkonu zastupuje:</span>
                  <span className="font-medium text-right">
                    {SPOLOK_REJSTRIK_INFO.statutarniOrgan.zastupuje.jmeno}
                  </span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-muted-foreground">Způsob jednání:</span>
                  <span className="font-medium text-right">
                    {SPOLOK_REJSTRIK_INFO.statutarniOrgan.zpusobJednani}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Účel spolku */}
          <Card>
            <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base">Účel spolku</CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-4 pt-0 sm:pt-0">
              <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                {SPOLOK_REJSTRIK_INFO.ucel}
              </p>
            </CardContent>
          </Card>

          {/* Hlavní a vedlejší činnost */}
          <div className="grid gap-3.5 sm:gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
                <CardTitle className="text-sm sm:text-base">Předmět hlavní činnosti</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-4 pt-0 sm:pt-0 space-y-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                {SPOLOK_REJSTRIK_INFO.predmetHlavniCinnosti.map((item, idx) => (
                  <p key={idx}>{item}</p>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
                <CardTitle className="text-sm sm:text-base">Předmět vedlejší hospodářské činnosti</CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 sm:p-4 pt-0 sm:pt-0 space-y-2 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                {SPOLOK_REJSTRIK_INFO.predmetVedlejsiCinnosti.map((item, idx) => (
                  <p key={idx}>{item}</p>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: SBIRKA LISTIN & ZAPIS */}
        <TabsContent value="listiny" className="space-y-4 pt-1">
          {/* Listiny z rejstříku */}
          <Card>
            <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <ScrollText className="size-4 text-muted-foreground" aria-hidden />
                Přehled digitalizovaných listin ve Sbírce listin
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Sbírka listin vedená Městským soudem v Praze ke spisové značce L 80354
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-4 pt-0 sm:pt-0 space-y-3">
              {SBIRKA_LISTIN_DOKUMENTY.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-lg border p-3 sm:p-4 space-y-2 bg-card/60 transition-colors hover:bg-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {doc.cislo}
                      </Badge>
                      <strong className="text-sm font-semibold">{doc.typ}</strong>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3" aria-hidden />
                        <span>Otevřít na justice.cz</span>
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{doc.popis}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Vznik: {doc.datumVzniku}</span>
                    <span>Založeno do SL: {doc.datumZapisu}</span>
                    <span>Počet stran: {doc.stran}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Detail zápisu z členské schůze */}
          <Card>
            <CardHeader className="p-3.5 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" aria-hidden />
                Zápis z členské schůze ze dne 3. 6. 2026
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {ZAPIS_CLENSKE_SCHUZE_2026.misto} · Zahájení {ZAPIS_CLENSKE_SCHUZE_2026.zahajeni}, ukončení {ZAPIS_CLENSKE_SCHUZE_2026.ukonceni}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 sm:p-4 pt-0 sm:pt-0 space-y-3 text-xs sm:text-sm">
              <div className="rounded-md bg-muted/60 p-3 space-y-1.5">
                <p className="font-medium">
                  Přítomné členstvo (všichni {ZAPIS_CLENSKE_SCHUZE_2026.pocetClenu} členové):
                </p>
                <ul className="list-inside list-disc text-muted-foreground space-y-0.5">
                  {ZAPIS_CLENSKE_SCHUZE_2026.pritomni.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground pt-1">
                  Předsedající: {ZAPIS_CLENSKE_SCHUZE_2026.predsedajici} · Zapisovatel: {ZAPIS_CLENSKE_SCHUZE_2026.zapisovatel}
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <h4 className="font-semibold text-xs sm:text-sm">Přijatá usnesení:</h4>
                {ZAPIS_CLENSKE_SCHUZE_2026.usneseni.map((u) => (
                  <div key={u.cislo} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs sm:text-sm">
                        Usnesení č. {u.cislo}: {u.nazev}
                      </span>
                      <Badge variant="secondary" className="text-[11px]">
                        Schváleno
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                      {u.text}
                    </p>
                    <p className="text-[11px] text-muted-foreground italic">{u.hlasovani}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
