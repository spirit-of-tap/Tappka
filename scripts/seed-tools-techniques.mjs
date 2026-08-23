// Idempotent seed script for Tools and Techniques example dataset.
// Usage:
//   node scripts/seed-tools-techniques.mjs
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

if (!serviceKey) {
  try {
    const statusOutput = execSync("pnpm supabase status -o env", { encoding: "utf-8" });
    for (const line of statusOutput.split("\n")) {
      const match = line.match(/^SERVICE_ROLE_KEY="(.+)"$/);
      if (match) serviceKey = match[1];
      const urlMatch = line.match(/^API_URL="(.+)"$/);
      if (urlMatch) supabaseUrl = urlMatch[1];
    }
  } catch {
    // ignore
  }
}

if (!serviceKey) {
  console.error("Could not find SUPABASE_SERVICE_ROLE_KEY. Make sure local Supabase is running.");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXAMPLE_DATA = [
  {
    tool_type: "tool",
    name: "Clockify",
    reflection: "Nástroj pro sledování času, který se mi osvědčil a je naprosto klíčový nejen pro vlastní reflexi nad tím, čím přes týden trávím čas, ale i z pohledu týmu, kdy jsme schopni analyzovat naše fungování na základě dat a ne domněnek.",
  },
  {
    tool_type: "tool",
    name: "Google Kalendář",
    reflection: "Nástroj na Tiimi je klíčový, užívám ho samozřejmě již nějakou dobu, ale snad nikdy v takové míře jako tady. Osvědčila se mi funkcionalita vyznačení si časů, kdy jsem dostupný, a následující generování odkazu, kde si ostatní mohou booknout čas se mnou. Používám ho pro výběr a rezervaci času na 1v1 ve své roli team leadra.",
  },
  {
    tool_type: "model",
    name: "Design Thinking",
    reflection: "Vedl jsem na daný model TS. Snažím se inklinovat k jeho používání téměř u každého projektu či aktivitě, kde se interaguje se zákazníky. Ať už jde o BG či práce v rámci IT house či projektech tvorby webů.",
  },
  {
    tool_type: "technique",
    name: "Reflexe plus delta",
    reflection: "Technika reflexe, která se drží principu KISS. Je jednoduchá a efektivní. Používáme ji nejen na téměř každém TS, ale snažím se tak vést zpětnou vazbu i na moje projekty mimo týmy nebo obecně, když podávám zpětnou vazbu.",
  },
  {
    tool_type: "tool",
    name: "Microsoft Forms",
    reflection: "Online formuláře se osvědčily jako efektivní způsob, jak donutit tým připravit se na TS. Zároveň slouží jako dobrý nástroj, jak při rozhodování získat rychle a efektivně data z týmu, ať už jde o názor na danou problematiku, či jen stav např.: ve metrikách. Napomáhá rozhodování na základě dat a ne domněnek.",
  },
  {
    tool_type: "tool",
    name: "Mermaid",
    reflection: "Jedná se o způsob zápisu všemožných diagramů, které se dají vepsat do markdown formátu. Úžasné využití je použít LLM, do kterého namluvíme proces, nad kterým uvažujeme. Necháme AI doptat se na slepá místa a pak jej nechat vygenerovat diagram právě v mermaid. Čímž se dají procesy velice jednoduše a efektivně vizualizovat bez složitého klikání. Vše vypadá profesionálně a je zdarma.",
  },
  {
    tool_type: "tool",
    name: "Gems",
    reflection: "Jedná se o funkcionalitu v Google Gemini, kde se dají přednastavit osobnosti. Osvědčilo se mi nastavit si osobnost chatu na kritika, který zkritizuje můj návrh či nápad a doplní slepá místa. Úžasné doplnění pro kritické myšlení. Jedná se o velice rychlý způsob, jak se vyhnout vlastnímu biosu myšlení.",
  },
  {
    tool_type: "tool",
    name: "NotebookLM",
    reflection: "Klíčová technologie, kterou používám při přípravě na každé TS a při jakémkoliv zpracování většího množství informací. Vracení se ke klíčovým informacím z knih apod.",
  },
  {
    tool_type: "model",
    name: "Eisenhowerova matice",
    reflection: "Způsob, jak si rychle a jednoduše rozřadit úkoly dle priority. Skvělá pomůcka, která nabízí jednoduchý systém a parametry, podle kterých řadit úkoly.",
  },
  {
    tool_type: "technique",
    name: "ECC Feedback",
    reflection: "Strukturovaná technika zpětné vazby: Evidence → Consequence → Change. Konkrétnější alternativa k plus/deltě při náročnějších rozhovorech — výkon, konflikty, podvýkon. Hodí se pro 1v1 s členy týmu.",
  },
  {
    tool_type: "technique",
    name: "1v1 check-ins",
    reflection: "Pravidelné individuální schůzky s členy týmu. Základ budování vztahu a důvěry v roli team leadra. Plánováno přes Google Kalendář s booking linkem.",
  },
  {
    tool_type: "model",
    name: "OKR / KPI stromy",
    reflection: "Propojení cílů týmu s měřitelnými indikátory výkonu. Základ pro datové vedení týmu a reflexi nad tím, zda jdeme správným směrem.",
  },
  {
    tool_type: "tool",
    name: "HALO peer assessment",
    reflection: "Peer hodnocení členů týmu. Generuje data pro výkonnostní rozhovory a umožňuje analýzu týmového fungování bez subjektivních domněnek.",
  },
  {
    tool_type: "model",
    name: "Kotter 8 kroků",
    reflection: "Model řízení změny aplikovaný při změnách v týmu nebo komunitě (např. komunitní kasa v TAP). Strukturuje proces od urgence po zakotvení změny.",
  },
  {
    tool_type: "tool",
    name: "Fakturoid",
    reflection: "Správa faktur vydaných i přijatých. Aktivní účet tuulico pro provoz družstva Tuuli Co. Základní nástroj finančního řízení cooperative.",
  },
  {
    tool_type: "tool",
    name: "Raynet CRM",
    reflection: "Správa klientů a obchodního pipeline pro WeBe projekty a další klientské zakázky. Umožňuje sledovat stav obchodních příležitostí.",
  },
  {
    tool_type: "tool",
    name: "LaTeX",
    reflection: "Profesionální sazba cenových nabídek a smluv pro klienty. Výstupy vypadají profesionálně a jsou konzistentní bez závislosti na MS Office.",
  },
  {
    tool_type: "tool",
    name: "Claude (Anthropic)",
    reflection: "LLM asistent pro generování dokumentů, kódu, analýzy, facilitátorských průvodců a custom skills pro Tuuli. Klíčový nástroj pro škálování vlastní práce.",
  },
  {
    tool_type: "tool",
    name: "tmux",
    reflection: "Terminálový multiplexer umožňující paralelní session a vzdálenou práci. Nezbytný nástroj pro efektivní práci v příkazové řádce a na serverech.",
  },
  {
    tool_type: "tool",
    name: "Next.js",
    reflection: "React framework pro tvorbu webů klientům v rámci WeBe projekty. Moderní stack s SSR a dobrým výkonem pro klientské weby.",
  },
  {
    tool_type: "tool",
    name: "Git / GitHub",
    reflection: "Verzování kódu a spolupráce na vývojářských projektech. Základ každého softwarového projektu — sledování změn, review, nasazení.",
  },
  {
    tool_type: "tool",
    name: "Self-hosted stack (Plane/n8n)",
    reflection: "Vlastní PM a automatizační nástroje hostované na vlastní infrastruktuře. Nezávislost na třetích stranách, plná kontrola nad daty a procesy.",
  },
  {
    tool_type: "tool",
    name: "Markdown / Obsidian",
    reflection: "Systém poznámek a knowledge base. Propojené myšlenky, přípravy na TS, dokumentace projektů v plain-text formátu bez vendor lock-in.",
  },
  {
    tool_type: "model",
    name: "Lean Canvas",
    reflection: "Rychlé zmapování business modelu projektu na jednu stránku. Používáno při analýze WeBe i dalších projektů — od problému přes řešení po revenue streams.",
  },
  {
    tool_type: "model",
    name: "SWOT analýza",
    reflection: "Strategická analýza projektů a týmového směřování. Rychlý způsob, jak strukturovat silné/slabé stránky a příležitosti/hrozby.",
  },
  {
    tool_type: "model",
    name: "Prioritizační matice (dopad × náročnost)",
    reflection: "Výběr aktivit podle kombinace očekávaného dopadu a náročnosti realizace. Pomáhá soustředit energii tam, kde přináší největší hodnotu.",
  },
];

async function main() {
  console.log("🌱 Seeding Tools & Techniques example data...");

  const { data: profiles, error: profErr } = await sb
    .from("profiles")
    .select("id, name, work_email")
    .order("created_at");

  if (profErr || !profiles || profiles.length === 0) {
    console.error("No profiles found in database:", profErr);
    process.exit(1);
  }

  // Target profiles: find Ondřej / all active profiles with beta access or first profile
  for (const profile of profiles) {
    console.log(`\nImporting for profile: ${profile.name} (${profile.id})...`);

    for (const item of EXAMPLE_DATA) {
      const { data: existing } = await sb
        .from("tools_techniques")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("name", item.name)
        .is("removed_at", null)
        .maybeSingle();

      if (existing) {
        console.log(`  - Exists: ${item.name}`);
        continue;
      }

      const { error: insertErr } = await sb.from("tools_techniques").insert({
        profile_id: profile.id,
        tool_type: item.tool_type,
        name: item.name,
        reflection: item.reflection,
        created_by_profile_id: profile.id,
        updated_by_profile_id: profile.id,
      });

      if (insertErr) {
        console.error(`  - Failed to insert ${item.name}:`, insertErr.message);
      } else {
        console.log(`  + Inserted: [${item.tool_type}] ${item.name}`);
      }
    }
  }

  console.log("\n🎉 Tools & Techniques seed complete!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
