import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink, Github, Linkedin } from "lucide-react";

export const metadata: Metadata = {
  title: "O Tappce",
  description:
    "Proč vznikla Tappka: digitalizace agendy Tiimiakatemia Prague z excelových tabulek do open-source webové aplikace.",
  openGraph: {
    title: "O Tappce – Tiimiakatemia Prague",
    description:
      "Digitalizace agendy Tiimiakatemia Prague z excelových tabulek do open-source webové aplikace.",
    images: ["/tap_logo.png"],
  },
  twitter: {
    card: "summary",
    title: "O Tappce – Tiimiakatemia Prague",
    description:
      "Digitalizace agendy Tiimiakatemia Prague z excelových tabulek do open-source webové aplikace.",
    images: ["/tap_logo.png"],
  },
};

const GITHUB_REPO_URL = "https://github.com/spirit-of-tap/Tappka";

const AUTHORS = [
  {
    name: "Ondřej Kulhavý",
    linkedin: "https://www.linkedin.com/in/ondrejkulhavy/",
  },
  {
    name: "Tomáš Protiva",
    linkedin: "https://www.linkedin.com/in/tomprotiva/",
  },
  {
    name: "Ondřej Schlossar",
    linkedin: "https://www.linkedin.com/in/ond%C5%99ej-schlossar/",
  },
] as const;

export default async function AboutPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header with PEF Logo */}
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
            {isLoggedIn ? (
              <Button asChild size="sm">
                <Link href="/">
                  Do aplikace
                  <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link href="/auth/login">
                  Přihlášení
                  <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Article Content */}
      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6">
        <article className="container max-w-2xl mx-auto space-y-8 text-base sm:text-lg leading-relaxed text-foreground/90 font-normal">
          {/* TAP Logo & Header */}
          <header className="space-y-4">
            <div className="flex items-center gap-4">
              <Image
                src="/tap_logo.png"
                alt="TAP Logo"
                width={80}
                height={80}
                className="object-contain shrink-0"
                priority
              />
              <div>
                <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                  O Tappce
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-0.5">
                  Studentský portál Tiimiakatemia Prague
                </p>
              </div>
            </div>
          </header>

          <hr className="border-border" />

          <section className="space-y-4">
            <p>
              Na Tiimiakatemii se celá studijní i týmová agenda roky vedla
              v&nbsp;obřích excelových sešitech. Každý soubor měl přes 10 listů,
              stovky řádků a sdílely ho desítky lidí najednou.
            </p>
            <p>
              Výsledek byl v praxi dost nepraktický: data nebyla normalizovaná,
              nešlo nad nimi dělat spolehlivou analýzu, vzorce se rozbíjely
              a&nbsp;při souběžných úpravách docházelo ke konfliktům. Vyplňování
              tabulek zabíralo zbytečně moc času.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Proč jsme ji postavili
            </h2>
            <p>
              Tři studující — <strong>Ondřej Kulhavý</strong>,{" "}
              <strong>Tomáš Protiva</strong> a <strong>Ondřej Schlossar</strong> —
              se rozhodli tabulkový chaos nahradit jednoúčelovou webovou aplikací
              s&nbsp;relační databází, která vyhovuje potřebám studujících
              i&nbsp;koučů:ek na PEF ČZU.
            </p>
            <p>Tappka dnes pokrývá:</p>
            <ul className="list-disc pl-6 space-y-2 text-base text-foreground/80">
              <li>
                <strong>Knihovnu a četbu:</strong> katalog knih, evidenci fyzických
                výpůjček, odevzdávání a hodnocení esejů i počítání bodů.
              </li>
              <li>
                <strong>Birth Giving:</strong> správu inovačních výzev, týmů, zadání
                a výsledků.
              </li>
              <li>
                <strong>Rezervace místností:</strong> přehled a rezervaci týmových
                prostor na fakultě.
              </li>
              <li>
                <strong>Týmovou agendu:</strong> týmové smlouvy, deníky a
                semestrální reflexe.
              </li>
              <li>
                <strong>Zákaznické schůzky &amp; koučování:</strong> záznamy
                z&nbsp;jednání s klienty a individuálních koučování.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Open source
            </h2>
            <p>
              Aplikace je otevřená (open source). Celý kód je dostupný na GitHubu,
              aby na něm mohly stavět a rozvíjet ho další ročníky.
            </p>
            <div>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="size-4" />
                  <span>GitHub repozitář</span>
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Autoři
            </h2>
            <div className="flex flex-wrap gap-3">
              {AUTHORS.map((author) => (
                <a
                  key={author.name}
                  href={author.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
                >
                  <Linkedin className="size-3.5 text-primary" />
                  <span>{author.name}</span>
                  <ExternalLink className="size-3 opacity-50" />
                </a>
              ))}
            </div>
          </section>

          <hr className="border-border" />

          {/* Action Link */}
          <div className="pt-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>Tiimiakatemia Prague, PEF ČZU</span>
            <Link
              href="/auth/login"
              className="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors"
            >
              Přejít na přihlášení →
            </Link>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4 sm:px-6 bg-muted/10 text-xs text-muted-foreground">
        <div className="container max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>© Tiimiakatemia Prague {new Date().getFullYear()}</span>
            <span>•</span>
            <span>Spirit of TAP / IT House</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors underline underline-offset-4"
            >
              GitHub
            </a>
            <Link
              href="/ochrana-soukromi"
              className="hover:text-foreground transition-colors underline underline-offset-4"
            >
              Ochrana soukromí
            </Link>
            <Link
              href="/auth/login"
              className="hover:text-foreground transition-colors underline underline-offset-4"
            >
              Přihlášení
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
