import { defineConfig } from 'vitepress';

export default defineConfig({
  base: process.env.VITEPRESS_BASE ?? (process.env.GITHUB_PAGES === 'true' ? '/Tappka/' : '/'),
  lang: 'cs-CZ',
  title: 'Tappka dokumentace',
  description: 'Interní dokumentace a znalostní báze platformy Tappka pro Tiimiakatemia Praha',
  cleanUrls: true,
  ignoreDeadLinks: true,
  markdown: {
    config(md) {
      const defaultFence = md.renderer.rules.fence!.bind(md.renderer.rules);
      let index = 0;
      md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
        const token = tokens[idx];
        const info = token.info.trim();
        if (info === 'mermaid') {
          const id = `mermaid-${index++}`;
          const code = encodeURIComponent(token.content);
          return `<ClientOnly><Mermaid id="${id}" code="${code}" /></ClientOnly>`;
        }
        return defaultFence(tokens, idx, options, env, slf);
      };
    },
  },
  vite: {
    optimizeDeps: {
      include: ['mermaid'],
    },
  },
  themeConfig: {
    logo: '/tap_logo.png',
    nav: [
      {
        text: 'Uživatelská příručka',
        items: [
          { text: 'Přehled a rozcestník', link: '/user-guide/' },
          { text: 'Rezervace místností', link: '/user-guide/rezervace-mistnosti' },
          { text: 'Čtení & Kniha knih (Bob)', link: '/user-guide/cteni-a-knihovna' },
        ],
      },
      {
        text: 'Technická dokumentace',
        items: [
          { text: 'Přehled architektury', link: '/architecture/overview' },
          { text: 'Technologický stack', link: '/architecture/tech-stack' },
          { text: 'Datová vrstva & RLS', link: '/data-layer' },
          { text: 'Katalog modulů', link: '/modules/overview' },
          { text: 'Runbooky pro vývoj', link: '/runbooks/development-setup' },
          { text: 'Testovací strategie', link: '/runbooks/testing' },
          { text: 'Portfolio Wiki', link: '/portfolio-sheets' },
        ],
      },
      {
        text: 'Vstoupit do Tappky',
        link: 'https://tiimi.cz',
        target: '_blank',
        rel: 'noreferrer',
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/spirit-of-tap/Tappka' },
    ],
    lastUpdated: {
      text: 'Poslední aktualizace',
      formatOptions: { dateStyle: 'short', timeStyle: 'short' },
    },
    editLink: {
      pattern: 'https://github.com/spirit-of-tap/Tappka/edit/production/docs/:path',
      text: 'Navrhnout úpravu na GitHubu',
    },
    search: {
      provider: 'local',
      options: {
        detailedView: true,
        locales: {
          root: {
            translations: {
              button: {
                buttonText: 'Hledat v dokumentaci...',
                buttonAriaLabel: 'Hledat v dokumentaci',
              },
              modal: {
                noResultsText: 'Nebyly nalezeny žádné výsledky',
                resetButtonTitle: 'Vymazat hledání',
                footer: {
                  selectText: 'vybrat',
                  navigateText: 'navigovat',
                  closeText: 'zavřít',
                },
              },
            },
          },
        },
      },
    },
    sidebar: {
      '/': [
        {
          text: 'Uživatelská příručka',
          collapsed: false,
          items: [
            { text: 'Přehled a rozcestník', link: '/user-guide/' },
            { text: 'Rezervace místností', link: '/user-guide/rezervace-mistnosti' },
            { text: 'Čtení & Kniha knih (Bob)', link: '/user-guide/cteni-a-knihovna' },
          ],
        },
        {
          text: 'Systém & Architektura',
          collapsed: false,
          items: [
            { text: 'Přehled architektury', link: '/architecture/overview' },
            { text: 'Technologický stack', link: '/architecture/tech-stack' },
            { text: 'Datová vrstva & RLS', link: '/data-layer' },
            { text: 'Autentizace & Oprávnění', link: '/architecture/auth-and-roles' },
            { text: 'Design systém & UI', link: '/architecture/design-system' },
            { text: 'Realtime události', link: '/architecture/realtime' },
          ],
        },
        {
          text: 'Katalog modulů (14 modulů)',
          collapsed: true,
          items: [
            { text: 'Přehled všech modulů', link: '/modules/overview' },
            { text: 'Rezervace místností', link: '/modules/reservations' },
            { text: 'Čtení a Eseje', link: '/modules/cteni-a-eseje' },
            { text: 'Knihovna a Výpůjčky', link: '/modules/knihovna' },
            { text: 'Týmová reflexe & Deník', link: '/modules/tymova-reflexe-a-denik' },
            { text: 'Týmové dokumenty & Finance', link: '/modules/tymove-dokumenty' },
            { text: 'Koučování a Sezení', link: '/modules/koucovani' },
            { text: 'Zákaznické schůzky', link: '/modules/zakaznicke-schuzky' },
            { text: 'Osobnostní testy', link: '/modules/osobnostni-testy' },
            { text: 'Nástroje & Techniky', link: '/modules/nastroje-a-techniky' },
            { text: 'Komunita & Profily', link: '/modules/komunita-a-profily' },
            { text: 'Zpětná vazba & Rocket Model', link: '/modules/zpetna-vazba' },
            { text: 'Birth Giving', link: '/modules/birth-giving' },
            { text: 'Portfolio studujících', link: '/modules/portfolio' },
          ],
        },
        {
          text: 'Příručky pro vývoj (Runbooky)',
          collapsed: false,
          items: [
            { text: 'Lokální vývojové prostředí', link: '/runbooks/development-setup' },
            { text: 'Databázové migrace (Drizzle)', link: '/runbooks/database-migrations' },
            { text: 'Testovací strategie', link: '/runbooks/testing' },
            { text: 'Drift migrační historie', link: '/runbooks/migration-history-drift' },
            { text: 'Jak přispívat (Contributing)', link: '/CONTRIBUTING' },
            { text: 'Jak psát dokumentaci', link: '/runbooks/writing-documentation' },
            { text: 'Nasazení & CI/CD', link: '/runbooks/deployment' },
            { text: 'Standardy kódu & Agenti', link: '/runbooks/agents-and-code-style' },
            { text: 'Známé chyby', link: '/KNOWN_BUGS' },
          ],
        },
        {
          text: 'Portfolio & Digitalizace',
          collapsed: true,
          items: [
            { text: 'Vizuální přehled listů', link: '/portfolio-sheets' },
            { text: 'Rejstřík portfolio wiki', link: '/wiki' },
          ],
        },
      ],
    },
    footer: {
      message: 'Tiimiakatemia Prague (ČZU PEF) — Interní kampus Tappka',
      copyright: 'Vytvořeno týmem Tappka',
    },
  },
});

