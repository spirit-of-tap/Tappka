import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Ochrana soukromí",
  description:
    "Jak Tappka zpracovává osobní údaje: správce, co se sdílí se školou, k čemu slouží měření používání a jaká máte práva.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container max-w-3xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/pef_logo/CZU_PEF_cerna_RGB.png"
              alt="ČZU PEF"
              width={120}
              height={34}
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/pef_logo/CZU_PEF_bila_RGB.png"
              alt="ČZU PEF"
              width={120}
              height={34}
              className="hidden object-contain dark:block"
              priority
            />
          </Link>

          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Button asChild size="sm" variant="outline">
              <Link href="/auth/login">
                Přihlášení
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6">
        <article className="container max-w-2xl mx-auto space-y-8 text-base sm:text-lg leading-relaxed text-foreground/90 font-normal">
          <header className="space-y-2">
            <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Ochrana soukromí
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Dvě věci držíme přísně odděleně: data aplikace, která patří
              studiu, a měření používání, které slouží jen k opravám.
            </p>
          </header>

          <hr className="border-border" />

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Správce údajů
            </h2>
            <p>
              Správcem osobních údajů je spolek{" "}
              <strong>Spirit of TAP, z.s.</strong>, IČO 23152036, se sídlem
              Blatenská 4018, 430 03 Chomutov, zapsaný ve spolkovém rejstříku
              vedeném Městským soudem v Praze, spisová značka L 80354. Spolek
              provozuje Tappku proto, aby pomáhal studujícím s jejich studiem.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Kdo má do aplikace přístup
            </h2>
            <p>
              Přístup mají pouze aktivně studující a zaměstnanci:ky školy.
              Přístup neschvalujeme nikomu mimo školu. Čtení a rezervace jsou
              viditelné pro všechny, kdo do aplikace patří — nic z toho není
              veřejné na internetu.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Data aplikace a škola
            </h2>
            <p>
              Účet (jméno, e-mail, tým) a obsah, který vytváříte — eseje,
              rezervace, výpůjčky a další studijní záznamy — postupně nahrazují
              excelové tabulky, které dnes vede škola. Tato data proto škola
              (PEF ČZU) vidí a používá pro studijní agendu, stejně jako dřív
              viděla tabulky.
            </p>
            <p>
              Co škola se svými kopiemi a zálohami dělá dál, je mimo naše ruce:
              za jejich další nakládání odpovídá škola podle vlastních pravidel.
              Provozní data aplikace běží v databázi hostované ve Švýcarsku —
              zemi, kterou EU uznává jako poskytující odpovídající ochranu
              údajů.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Měření používání: jen k opravám, nikdy ke kontrole
            </h2>
            <p>
              <strong>
                Údaje z měření používání škole nikdy nepředáváme.
              </strong>{" "}
              Neslouží k tomu, aby škola zjišťovala, zda a jak často aplikaci
              otevíráte — na takový dotaz škole data neposkytneme.
            </p>
            <p>
              K čemu tedy slouží? Když nahlásíte, že se něco rozbilo, potřebujeme
              vidět, co se stalo: kde se klikalo, jaká chyba nastala a případně
              záznam relace, abychom chybu uměli zopakovat a opravit. Proto —
              a pouze se souhlasem v dialogu při první návštěvě — měříme, jak
              se používají rezervace a čtení, a zaznamenáváme chyby.
              Bez souhlasu se neměří nic
              a souhlas lze kdykoli odvolat.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base text-foreground/80">
              <li>Události měření používání: nejdéle 90 dní.</li>
              <li>Chybové záznamy a záznamy relací: nejdéle 30 dní.</li>
              <li>Uložení v EU u zpracovatele PostHog, se kterým má spolek
                smlouvu o zpracování osobních údajů.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Soubory cookies
            </h2>
            <p>
              Měření používá soubory začínající <code>ph_</code> a končící{" "}
              <code>_posthog</code>: pamatují si souhlas s měřením a
              rozpoznávají vracející se prohlížeč. Bez souhlasu se neukládají.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Vaše práva
            </h2>
            <p>
              Máte právo na přístup k údajům, jejich opravu a výmaz, omezení
              zpracování a odvolání souhlasu. Práva uplatníte zprávou přes
              Zpětnou vazbu v aplikaci nebo písemně na sídlo spolku. Se
              stížností se lze obrátit na Úřad pro ochranu osobních údajů.
            </p>
          </section>

          <hr className="border-border" />

          <div className="pt-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>Spirit of TAP, z.s. • IČO 23152036</span>
            <Link
              href="/about"
              className="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors"
            >
              O Tappce →
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
