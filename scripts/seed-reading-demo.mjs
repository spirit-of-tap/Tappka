// Idempotent local-dev seed for Books, Library copies, Book Loans, and Essays.
// Run against the local Supabase stack:
//   node scripts/seed-reading-demo.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

// Try reading .env.local or fallback to supabase status
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";

if (!serviceKey && existsSync(resolve(".env.local"))) {
  const content = readFileSync(resolve(".env.local"), "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^['"](.*)['"]$/, "$1");
      if (key === "SUPABASE_SERVICE_ROLE_KEY") serviceKey = val;
      if (key === "NEXT_PUBLIC_SUPABASE_URL") supabaseUrl = val;
    }
  }
}

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
  console.error("Could not find SUPABASE_SERVICE_ROLE_KEY. Ensure local supabase is running.");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function docJson(paragraphs) {
  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

async function main() {
  console.log("🌱 Starting Reading & Loans demo data seed...");

  // 1. Get system profile and available profiles
  const { data: profiles, error: profErr } = await sb
    .from("profiles")
    .select("id, name, role, work_email, team_id")
    .order("created_at");

  if (profErr || !profiles || profiles.length === 0) {
    console.error("Error fetching profiles:", profErr);
    process.exit(1);
  }

  const systemProfile = profiles.find((p) => p.work_email === "admin@studenti.czu.cz") ?? profiles[0];
  const ondrej = profiles.find((p) => p.work_email === "xkulo007@studenti.czu.cz" || p.user_id);
  const mainStudent = ondrej ?? profiles.find((p) => p.role === "student" || p.role === "admin") ?? profiles[0];
  const students = profiles.filter((p) => p.role === "student" || p.role === "admin");

  console.log(`Found ${profiles.length} profiles. Using main student: ${mainStudent.name} (${mainStudent.id})`);

  // 2. Ensure Highlight Categories exist
  const { data: existingHc } = await sb.from("highlight_categories").select("id, name");
  let topBobId = existingHc?.find((h) => h.name.includes("TOP BOB") || h.name.includes("Základní"))?.id;

  if (!topBobId) {
    const { data: newHc, error: hcErr } = await sb
      .from("highlight_categories")
      .insert({
        name: "TOP BOB — Doporučená četba",
        description: "Výběr nejlépe hodnocených knih kouči:kami a komunitou.",
        created_by_profile_id: systemProfile.id,
        updated_by_profile_id: systemProfile.id,
      })
      .select()
      .single();
    if (hcErr) console.warn("Could not insert highlight category:", hcErr.message);
    else topBobId = newHc?.id;
  }

  // 3. Books dataset
  const DEMO_BOOKS = [
    {
      title_cs: "Clean Code",
      author: "Robert C. Martin",
      book_points: "3.00",
      list_status: "shortlist",
      is_rocket_model: true,
      isbn_13: "9780132350884",
      description: "Příručka agilního softwarového řemesla a psaní udržitelného, čitelného kódu.",
      page_count: 464,
      highlight_category_id: topBobId ?? null,
    },
    {
      title_cs: "Atomové návyky",
      author: "James Clear",
      book_points: "3.00",
      list_status: "shortlist",
      is_rocket_model: false,
      isbn_13: "9788075550958",
      description: "Drobné změny, které vedou k pozoruhodným výsledkům a trvalým návykům.",
      page_count: 320,
      highlight_category_id: topBobId ?? null,
    },
    {
      title_cs: "Začněte s PROČ",
      author: "Simon Sinek",
      book_points: "3.00",
      list_status: "shortlist",
      is_rocket_model: true,
      isbn_13: "9788087270554",
      description: "Jak velcí lídři inspirují ostatní k akci a jak budovat loajální týmy.",
      page_count: 256,
      highlight_category_id: topBobId ?? null,
    },
    {
      title_cs: "Sprint",
      author: "Jake Knapp",
      book_points: "2.50",
      list_status: "shortlist",
      is_rocket_model: false,
      isbn_13: "9788075550217",
      description: "Jak otestovat nové nápady a vyřešit velké problémy v pouhých pěti dnech.",
      page_count: 288,
      highlight_category_id: null,
    },
    {
      title_cs: "Radikální otevřenost",
      author: "Kim Scott",
      book_points: "3.00",
      list_status: "shortlist",
      is_rocket_model: false,
      isbn_13: "9788075550576",
      description: "Jak být skvělým lídrem a neztrácet lidskost — upřímná a přímá zpětná vazba.",
      page_count: 312,
      highlight_category_id: topBobId ?? null,
    },
    {
      title_cs: "The Lean Startup",
      author: "Eric Ries",
      book_points: "3.00",
      list_status: "shortlist",
      is_rocket_model: true,
      isbn_13: "9780307887894",
      description: "Jak dnešní podnikatelé využívají nepřetržité inovace k vytvoření radikálně úspěšných firem.",
      page_count: 336,
      highlight_category_id: null,
    },
  ];

  const bookIdMap = new Map();

  for (const b of DEMO_BOOKS) {
    const { data: existing } = await sb
      .from("books")
      .select("id")
      .eq("title_cs", b.title_cs)
      .maybeSingle();

    if (existing) {
      bookIdMap.set(b.title_cs, existing.id);
    } else {
      const { data: inserted, error: bErr } = await sb
        .from("books")
        .insert({
          ...b,
          created_by_profile_id: systemProfile.id,
          updated_by_profile_id: systemProfile.id,
        })
        .select("id")
        .single();
      if (bErr) console.warn(`Error inserting book ${b.title_cs}:`, bErr.message);
      else bookIdMap.set(b.title_cs, inserted.id);
    }
  }

  console.log(`✅ Seeded ${bookIdMap.size} books.`);

  // 4. Create Library Copies
  const libraryCopiesMap = new Map(); // bookTitle -> library_book_id[]

  for (const [title, bookId] of bookIdMap.entries()) {
    const { data: existingCopies } = await sb
      .from("library_books")
      .select("id")
      .eq("book_id", bookId);

    const copies = existingCopies ?? [];
    if (copies.length === 0) {
      const { data: newCopies, error: cErr } = await sb
        .from("library_books")
        .insert([
          {
            book_id: bookId,
            created_by_profile_id: systemProfile.id,
            updated_by_profile_id: systemProfile.id,
          },
          {
            book_id: bookId,
            created_by_profile_id: systemProfile.id,
            updated_by_profile_id: systemProfile.id,
          },
        ])
        .select("id");

      if (cErr) console.warn(`Error creating copies for ${title}:`, cErr.message);
      else libraryCopiesMap.set(title, newCopies.map((c) => c.id));
    } else {
      libraryCopiesMap.set(title, copies.map((c) => c.id));
    }
  }

  console.log(`✅ Seeded library physical copies.`);

  // 5. Seed Book Loans for mainStudent
  const cleanCodeCopies = libraryCopiesMap.get("Clean Code") ?? [];
  let cleanCodeCopyId = null;

  for (const copyId of cleanCodeCopies) {
    const { data: busy } = await sb
      .from("book_loans")
      .select("id")
      .eq("library_book_id", copyId)
      .is("returned_at", null)
      .maybeSingle();
    if (!busy) {
      cleanCodeCopyId = copyId;
      break;
    }
  }

  if (!cleanCodeCopyId) {
    const { data: newCopy } = await sb
      .from("library_books")
      .insert({
        book_id: bookIdMap.get("Clean Code"),
        created_by_profile_id: systemProfile.id,
        updated_by_profile_id: systemProfile.id,
      })
      .select("id")
      .single();
    cleanCodeCopyId = newCopy?.id;
  }

  if (cleanCodeCopyId) {
    const { data: activeLoan } = await sb
      .from("book_loans")
      .select("id")
      .eq("borrower_id", mainStudent.id)
      .is("returned_at", null)
      .maybeSingle();

    if (!activeLoan) {
      const now = new Date();
      const borrowedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const dueAt = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(); // due in 4 days

      await sb.from("book_loans").insert({
        library_book_id: cleanCodeCopyId,
        borrower_id: mainStudent.id,
        borrowed_at: borrowedAt,
        due_at: dueAt,
        returned_at: null,
      });
      console.log(`✅ Seeded active loan for "${mainStudent.name}": Clean Code (due in 4 days).`);
    }
  }

  const atomicCopyId = libraryCopiesMap.get("Atomové návyky")?.[0];
  const whyCopyId = libraryCopiesMap.get("Začněte s PROČ")?.[0];

  // Returned loan history for main student
  if (atomicCopyId) {
    const { data: pastLoan } = await sb
      .from("book_loans")
      .select("id")
      .eq("library_book_id", atomicCopyId)
      .eq("borrower_id", mainStudent.id)
      .not("returned_at", "is", null)
      .maybeSingle();

    if (!pastLoan) {
      await sb.from("book_loans").insert({
        library_book_id: atomicCopyId,
        borrower_id: mainStudent.id,
        borrowed_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        due_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        returned_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  if (whyCopyId) {
    const { data: pastLoan2 } = await sb
      .from("book_loans")
      .select("id")
      .eq("library_book_id", whyCopyId)
      .eq("borrower_id", mainStudent.id)
      .not("returned_at", "is", null)
      .maybeSingle();

    if (!pastLoan2) {
      await sb.from("book_loans").insert({
        library_book_id: whyCopyId,
        borrower_id: mainStudent.id,
        borrowed_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        due_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
        returned_at: new Date(Date.now() - 72 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  console.log(`✅ Seeded loan history for "${mainStudent.name}".`);

  // 6. Seed Essays for mainStudent and teammates
  const atomoveBookId = bookIdMap.get("Atomové návyky");
  const whyBookId = bookIdMap.get("Začněte s PROČ");
  const sprintBookId = bookIdMap.get("Sprint");
  const leanBookId = bookIdMap.get("The Lean Startup");

  // A. Pinned published essay for mainStudent
  if (atomoveBookId) {
    const { data: existingEssay } = await sb
      .from("essays")
      .select("id")
      .eq("author_profile_id", mainStudent.id)
      .eq("book_id", atomoveBookId)
      .maybeSingle();

    if (!existingEssay) {
      const { data: newEssay } = await sb
        .from("essays")
        .insert({
          author_profile_id: mainStudent.id,
          book_id: atomoveBookId,
          published_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
          pinned_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
          pinned_by_profile_id: mainStudent.id,
          created_by_profile_id: mainStudent.id,
          updated_by_profile_id: mainStudent.id,
        })
        .select("id")
        .single();

      if (newEssay) {
        await sb.from("essay_revisions").insert({
          essay_id: newEssay.id,
          revision_no: 1,
          title: "Jak aplikovat Atomové návyky v týmovém prostředí",
          content_json: docJson([
            "Kniha Atomové návyky od Jamese Cleara nabízí skvělý rámec nejen pro jednotlivce, ale i pro týmovou spolupráci v Tiimiakatemia.",
            "Klíčovým poznatkem pro náš tým bylo vytvoření společného prostředí, kde je žádoucí chování co nejjednodušší a viditelné pro všechny členy:ky.",
            "Zavedli jsme 2minutové ranní check-iny a týdenní retrospektivy, což nám pomohlo zautomatizovat sdílení informací.",
          ]),
          created_by_profile_id: mainStudent.id,
          updated_by_profile_id: mainStudent.id,
        });
      }
    }
  }

  // B. Another published essay for mainStudent
  if (whyBookId) {
    const { data: existingEssay } = await sb
      .from("essays")
      .select("id")
      .eq("author_profile_id", mainStudent.id)
      .eq("book_id", whyBookId)
      .maybeSingle();

    if (!existingEssay) {
      const { data: newEssay } = await sb
        .from("essays")
        .insert({
          author_profile_id: mainStudent.id,
          book_id: whyBookId,
          published_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
          created_by_profile_id: mainStudent.id,
          updated_by_profile_id: mainStudent.id,
        })
        .select("id")
        .single();

      if (newEssay) {
        await sb.from("essay_revisions").insert({
          essay_id: newEssay.id,
          revision_no: 1,
          title: "Leadership založený na PROČ podle Simona Sinka",
          content_json: docJson([
            "Zlatý kruh Simona Sinka vysvětluje, proč některé organizace a lídři dokáží inspirovat, zatímco jiní ne.",
            "Pro naše projekty je zásadní nejprve definovat náš smysl a hodnoty, a teprve poté hledat konkrétní produkty či služby.",
          ]),
          created_by_profile_id: mainStudent.id,
          updated_by_profile_id: mainStudent.id,
        });
      }
    }
  }

  // C. Draft essay for mainStudent
  if (sprintBookId) {
    const { data: existingDraft } = await sb
      .from("essays")
      .select("id")
      .eq("author_profile_id", mainStudent.id)
      .eq("book_id", sprintBookId)
      .is("published_at", null)
      .maybeSingle();

    if (!existingDraft) {
      const { data: newDraft } = await sb
        .from("essays")
        .insert({
          author_profile_id: mainStudent.id,
          book_id: sprintBookId,
          published_at: null,
          created_by_profile_id: mainStudent.id,
          updated_by_profile_id: mainStudent.id,
        })
        .select("id")
        .single();

      if (newDraft) {
        await sb.from("essay_revisions").insert({
          essay_id: newDraft.id,
          revision_no: 1,
          title: "Návrh design sprintu pro náš nový zákaznický projekt",
          content_json: docJson([
            "Pracovní poznámky k metodice Design Sprint od Jakea Knappa. Jak zkrátit prototypování na 5 dní a co k tomu budeme potřebovat v týmu.",
          ]),
          created_by_profile_id: mainStudent.id,
          updated_by_profile_id: mainStudent.id,
        });
      }
    }
  }

  // D. Teammate essays to populate team statistics
  const otherStudents = students.filter((s) => s.id !== mainStudent.id && s.team_id === mainStudent.team_id);
  const targetTeammates = otherStudents.length > 0 ? otherStudents : students.filter((s) => s.id !== mainStudent.id).slice(0, 4);

  for (let i = 0; i < targetTeammates.length; i++) {
    const teammate = targetTeammates[i];
    const bId = i % 2 === 0 ? leanBookId : whyBookId;
    if (!bId) continue;

    const { data: existing } = await sb
      .from("essays")
      .select("id")
      .eq("author_profile_id", teammate.id)
      .maybeSingle();

    if (!existing) {
      const { data: te } = await sb
        .from("essays")
        .insert({
          author_profile_id: teammate.id,
          book_id: bId,
          published_at: new Date(Date.now() - (10 + i * 15) * 24 * 60 * 60 * 1000).toISOString(),
          created_by_profile_id: teammate.id,
          updated_by_profile_id: teammate.id,
        })
        .select("id")
        .single();

      if (te) {
        await sb.from("essay_revisions").insert({
          essay_id: te.id,
          revision_no: 1,
          title: `Reflexe a aplikace v týmu (${teammate.name})`,
          content_json: docJson([
            `Tento text shrnuje klíčové myšlenky z knihy a jak jsme je aplikovali v našem týmu.`,
          ]),
          created_by_profile_id: teammate.id,
          updated_by_profile_id: teammate.id,
        });
      }
    }
  }

  console.log("✅ Seeded essays and revisions for student & teammates.");
  console.log("🎉 Reading & Loans demo data seeding complete!");
}

main().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
