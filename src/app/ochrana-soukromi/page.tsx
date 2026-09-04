import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Ochrana soukromí",
  description:
    "Jak Tappka zpracovává osobní údaje: správce, účely, uchovávání, práva a soubory cookies.",
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
              Jak Tappka nakládá s osobními údaji a co znamená souhlas
              s měřením používání.
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
              vedeném Městským soudem v Praze, spisová značka L 80354.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Jaké údaje zpracováváme
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-base text-foreground/80">
              <li>
                <strong>Účet:</strong> jméno, e-mail a zařazení do týmu — bez
                nich se nelze přihlásit a používat aplikaci.
              </li>
              <li>
                <strong>Obsah, který vytváříte:</strong> rezervace, eseje,
                výpůjčky a další záznamy podle toho, které části aplikace
                používáte.
              </li>
              <li>
                <strong>Měření používání (pouze se souhlasem):</strong> jak se
                používají rezervace a čtení a kdy nastane chyba. Neměříme obsah
                esejí, zpráv ani dokumentů — pouze to, která část aplikace se
                otevřela a jaká akce proběhla.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Proč a na jakém základě
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-base text-foreground/80">
              <li>
                <strong>Provoz aplikace</strong> (účet a obsah): plnění účelu
                spolku — podpora studujících Inovativního podnikání na PEF ČZU.
              </li>
              <li>
                <strong>Měření používání a chyb</strong>: výhradně váš souhlas
                v dialogu při první návštěvě. Souhlas kdykoli odvoláte
                odmítnutím v tomto dialogu nebo zprávou přes Zpětnou vazbu
                v aplikaci. Bez souhlasu se neměří nic.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Jak dlouho údaje držíme
            </h2>
            <ul className="list-disc pl-6 space-y-2 text-base text-foreground/80">
              <li>Účet a obsah: po dobu studia a členství ve spolku.</li>
              <li>Události měření používání: nejdéle 90 dní.</li>
              <li>Chybové záznamy: nejdéle 30 dní.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Komu údaje předáváme
            </h2>
            <p>
              Data neběží přes žádné reklamní sítě. Měření používání zajišťuje
              zpracovatel <strong>PostHog</strong> s uložením v EU. Bezpečnostní
              a provozní zázemí aplikace běží u poskytovatele hostingu databáze.
              Se zpracovateli má spolek uzavřené smlouvy o zpracování osobních
              údajů.
            </p>
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
