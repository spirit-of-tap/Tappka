// Seed script to add example coach comments and student replies in local dev.
// Run: node scripts/seed-coach-comments.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

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

async function main() {
  console.log("💬 Starting Coach Comments & Replies seed...");

  // 1. Fetch coach and admin profiles
  const { data: coaches, error: coachErr } = await sb
    .from("profiles")
    .select("id, name, role")
    .in("role", ["coach", "admin"])
    .order("created_at");

  if (coachErr || !coaches || coaches.length === 0) {
    console.error("No coach/admin profiles found:", coachErr);
    process.exit(1);
  }

  const primaryCoach = coaches[0];
  console.log(`Using coach: ${primaryCoach.name} (${primaryCoach.id})`);

  // 2. Fetch published essays
  const { data: essays, error: essayErr } = await sb
    .from("essays")
    .select("id, author_profile_id, published_at")
    .not("published_at", "is", null)
    .is("removed_at", null)
    .order("published_at", { ascending: false })
    .limit(10);

  if (essayErr || !essays || essays.length === 0) {
    console.error("No published essays found:", essayErr);
    process.exit(1);
  }

  console.log(`Found ${essays.length} essays to seed comments for.`);

  // Essay 1: Coach commented, Student REPLIED
  if (essays[0]) {
    const essay1 = essays[0];
    // Check if comments already exist
    const { data: existingComments } = await sb
      .from("essay_comments")
      .select("id")
      .eq("essay_id", essay1.id);

    if (!existingComments || existingComments.length === 0) {
      const coachCommentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const studentReplyDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

      // Insert coach comment
      const { data: coachComment } = await sb
        .from("essay_comments")
        .insert({
          essay_id: essay1.id,
          author_profile_id: primaryCoach.id,
          body: "Skvělá reflexe! Jak konkrétně jste ale otestovali hypotézu s prvními zákazníky na trhu?",
          created_at: coachCommentDate,
          created_by_profile_id: primaryCoach.id,
          updated_by_profile_id: primaryCoach.id,
        })
        .select("id")
        .single();

      if (coachComment) {
        // Insert student reply
        await sb.from("essay_comments").insert({
          essay_id: essay1.id,
          author_profile_id: essay1.author_profile_id,
          parent_id: coachComment.id,
          body: "Ahoj, díky za feedback! Udělali jsme 10 hloubkových rozhovorů s cílovkou a upravili cenotvorbu. V další verzi to doplním do textu.",
          created_at: studentReplyDate,
          created_by_profile_id: essay1.author_profile_id,
          updated_by_profile_id: essay1.author_profile_id,
        });

        console.log(`✅ Seeded Thread (Coach comment + Student reply) on essay ${essay1.id}`);
      }
    }
  }

  // Essay 2: Coach commented, Student has NOT replied yet
  if (essays[1]) {
    const essay2 = essays[1];
    const { data: existingComments } = await sb
      .from("essay_comments")
      .select("id")
      .eq("essay_id", essay2.id);

    if (!existingComments || existingComments.length === 0) {
      const coachCommentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

      await sb.from("essay_comments").insert({
        essay_id: essay2.id,
        author_profile_id: primaryCoach.id,
        body: "Zajímavý vhled do metodiky. Doporučuji ještě doplnit, jak jste nastavili metriky úspěchu v týmu a co byste příště udělali jinak.",
        created_at: coachCommentDate,
        created_by_profile_id: primaryCoach.id,
        updated_by_profile_id: primaryCoach.id,
      });

      console.log(`✅ Seeded Coach comment without reply on essay ${essay2.id}`);
    }
  }

  // Essay 3: Another coach comment with reply
  if (essays[2]) {
    const essay3 = essays[2];
    const { data: existingComments } = await sb
      .from("essay_comments")
      .select("id")
      .eq("essay_id", essay3.id);

    if (!existingComments || existingComments.length === 0) {
      const coachCommentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const studentReplyDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

      const { data: coachComment } = await sb
        .from("essay_comments")
        .insert({
          essay_id: essay3.id,
          author_profile_id: primaryCoach.id,
          body: "Moc se mi líbí propojení teorie s vaší praxí v týmovém projektu. Zvažte prezentaci tohoto postupu na společném tréninku.",
          created_at: coachCommentDate,
          created_by_profile_id: primaryCoach.id,
          updated_by_profile_id: primaryCoach.id,
        })
        .select("id")
        .single();

      if (coachComment) {
        await sb.from("essay_comments").insert({
          essay_id: essay3.id,
          author_profile_id: essay3.author_profile_id,
          parent_id: coachComment.id,
          body: "Díky moc! Rádi připravíme 10minutový showcase na příští tréninkový blok.",
          created_at: studentReplyDate,
          created_by_profile_id: essay3.author_profile_id,
          updated_by_profile_id: essay3.author_profile_id,
        });

        console.log(`✅ Seeded Thread 2 (Coach comment + Student reply) on essay ${essay3.id}`);
      }
    }
  }

  // Essay 4: Coach commented, and Author wrote a standalone comment AFTER it (parent_id is null)
  if (essays[3]) {
    const essay4 = essays[3];
    const { data: existingComments } = await sb
      .from("essay_comments")
      .select("id")
      .eq("essay_id", essay4.id);

    if (!existingComments || existingComments.length === 0) {
      const coachCommentDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const studentCommentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      await sb.from("essay_comments").insert({
        essay_id: essay4.id,
        author_profile_id: primaryCoach.id,
        parent_id: null,
        body: "Doporučuji se ještě zamyslet nad riziky spojenými s rychlou škálovatelností. Máte plán B?",
        created_at: coachCommentDate,
        created_by_profile_id: primaryCoach.id,
        updated_by_profile_id: primaryCoach.id,
      });

      await sb.from("essay_comments").insert({
        essay_id: essay4.id,
        author_profile_id: essay4.author_profile_id,
        parent_id: null, // Standalone comment without parent_id, but posted AFTER the coach's comment
        body: "Doplňuji poznámku k rizikům: Plán B jsme sepsali do naší týmové Notion dokumentace a omezili počáteční investice do marketingu.",
        created_at: studentCommentDate,
        created_by_profile_id: essay4.author_profile_id,
        updated_by_profile_id: essay4.author_profile_id,
      });

      console.log(`✅ Seeded Thread 3 (Coach comment + standalone author comment afterwards) on essay ${essay4.id}`);
    }
  }

  // Essay 5: Multiple comments by coach, and author replied to one of them (Author reply is latest)
  if (essays[4]) {
    const essay5 = essays[4];
    const { data: existingComments } = await sb
      .from("essay_comments")
      .select("id")
      .eq("essay_id", essay5.id);

    if (!existingComments || existingComments.length === 0) {
      const coachComment1Date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const coachComment2Date = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const studentReplyDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const { data: c1 } = await sb.from("essay_comments").insert({
        essay_id: essay5.id,
        author_profile_id: primaryCoach.id,
        parent_id: null,
        body: "Krásný úvod do problematiky. Máte k tomu i nějaké konkrétní číselné výsledky z testování?",
        created_at: coachComment1Date,
        created_by_profile_id: primaryCoach.id,
        updated_by_profile_id: primaryCoach.id,
      }).select("id").single();

      await sb.from("essay_comments").insert({
        essay_id: essay5.id,
        author_profile_id: primaryCoach.id,
        parent_id: null,
        body: "A jak jste vyřešili rozdělení rolí a odpovědnosti v týmu při samotné realizaci?",
        created_at: coachComment2Date,
        created_by_profile_id: primaryCoach.id,
        updated_by_profile_id: primaryCoach.id,
      });

      if (c1) {
        await sb.from("essay_comments").insert({
          essay_id: essay5.id,
          author_profile_id: essay5.author_profile_id,
          parent_id: c1.id,
          body: "Ahoj, k výsledkům: podařilo se nám dosáhnout obratu 45 000 Kč během prvního měsíce a získat 12 vracejících se zákazníků.",
          created_at: studentReplyDate,
          created_by_profile_id: essay5.author_profile_id,
          updated_by_profile_id: essay5.author_profile_id,
        });
      }

      console.log(`✅ Seeded Thread 4 (2 coach comments + 1 student reply) on essay ${essay5.id}`);
    }
  }

  // Essay 6: Dialogue where Coach commented -> Student replied -> Coach asked follow-up (Coach comment is latest)
  if (essays[5]) {
    const essay6 = essays[5];
    const { data: existingComments } = await sb
      .from("essay_comments")
      .select("id")
      .eq("essay_id", essay6.id);

    if (!existingComments || existingComments.length === 0) {
      const coachComment1Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const studentReplyDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const coachFollowUpDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const { data: c1 } = await sb.from("essay_comments").insert({
        essay_id: essay6.id,
        author_profile_id: primaryCoach.id,
        parent_id: null,
        body: "Jak jste v praxi přistoupili k validaci zájmu o tento produkt?",
        created_at: coachComment1Date,
        created_by_profile_id: primaryCoach.id,
        updated_by_profile_id: primaryCoach.id,
      }).select("id").single();

      if (c1) {
        await sb.from("essay_comments").insert({
          essay_id: essay6.id,
          author_profile_id: essay6.author_profile_id,
          parent_id: c1.id,
          body: "Vytvořili jsme jednoduchý web a sbírali nezávazné předobjednávky přes formulář.",
          created_at: studentReplyDate,
          created_by_profile_id: essay6.author_profile_id,
          updated_by_profile_id: essay6.author_profile_id,
        });
      }

      await sb.from("essay_comments").insert({
        essay_id: essay6.id,
        author_profile_id: primaryCoach.id,
        parent_id: null,
        body: "Výborný krok! Kolik lidí z těch předobjednávek reálně zaplatilo zálohu předem?",
        created_at: coachFollowUpDate,
        created_by_profile_id: primaryCoach.id,
        updated_by_profile_id: primaryCoach.id,
      });

      console.log(`✅ Seeded Thread 5 (Coach -> Student -> Coach follow-up) on essay ${essay6.id}`);
    }
  }

  // Mark essay1, essay2, essay4, essay5, essay6 as read in essay_coach_reads
  if (essays[0]) {
    await sb.from("essay_coach_reads").upsert({
      essay_id: essays[0].id,
      coach_profile_id: primaryCoach.id,
      read_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  if (essays[1]) {
    await sb.from("essay_coach_reads").upsert({
      essay_id: essays[1].id,
      coach_profile_id: primaryCoach.id,
      read_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  if (essays[3]) {
    await sb.from("essay_coach_reads").upsert({
      essay_id: essays[3].id,
      coach_profile_id: primaryCoach.id,
      read_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  if (essays[4]) {
    await sb.from("essay_coach_reads").upsert({
      essay_id: essays[4].id,
      coach_profile_id: primaryCoach.id,
      read_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  if (essays[5]) {
    await sb.from("essay_coach_reads").upsert({
      essay_id: essays[5].id,
      coach_profile_id: primaryCoach.id,
      read_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  console.log("🎉 Coach comments and replies seeding complete!");
}

main().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
