"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { PLATNE_STANOVY_2026 } from "@/lib/komunitni-kasa/stanovy-data";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

/** Úplné znění stanov: hledání + rozbalovací články. */
export function StanovyView() {
  const [query, setQuery] = useState("");

  const articles = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("cs");
    if (!q) return PLATNE_STANOVY_2026;
    return PLATNE_STANOVY_2026.filter(
      (article) =>
        String(article.number) === q ||
        article.title.toLocaleLowerCase("cs").includes(q) ||
        article.paragraphs.some((p) => p.toLocaleLowerCase("cs").includes(q)),
    );
  }, [query]);

  // Při hledání rozbalíme všechny nalezené články.
  const searching = query.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hledej v textu stanov, třeba členství nebo příspěvky"
          className="pl-9"
          aria-label="Hledat v textu stanov"
        />
      </div>

      {articles.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Hledání „{query.trim()}“ neodpovídá žádný článek
        </p>
      ) : (
        <Accordion
          key={searching ? `q:${query}` : "all"}
          type="multiple"
          defaultValue={searching ? articles.map((a) => String(a.number)) : []}
          className="border-y"
        >
          {articles.map((article) => (
            <AccordionItem key={article.number} value={String(article.number)}>
              <AccordionTrigger className="py-4 text-base">
                <span className="font-heading font-semibold">
                  Čl. {article.number} · {article.title}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pb-2 leading-relaxed">
                  {article.paragraphs.map((paragraph, index) => (
                    <p key={index} className="whitespace-pre-line">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
