// Idempotent local-dev seed for Birth Giving (three-table model).
// Run against the local Supabase stack:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-birth-giving.mjs
//
// Scenario: Ondřej Kulhavý is seeded as an ATTENDEE (team member) — never as an
// organizer — across the event-lifecycle variants the UI renders:
//   1. upcoming + assignment not yet uploaded (none)
//   2. started + assignment present/released + results yet to be submitted
//   3. started + assignment missing
//   4. past + winner team + some reflections submitted (Ondřej's still open)
//   5. past + all reflections submitted (Ondřej done)
//   6. upcoming + assignment already uploaded (present) — embargoed from
//      attendees until starts_at
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required");
  process.exit(1);
}
const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Real local profiles (id -> short name). Ondřej is the attendee under test.
const ONDREJ = "542cabe4-4f88-47bc-9b87-05cfafc899d2"; // Ondřej Kulhavý (beta)
const ORGANIZERS = {
  anna: "ae11b911-3524-4c0e-87c2-534392f8f6e0", // Anna Pokorná (beta)
  petr: "2aae1563-5a1f-45b2-91cd-c2f5aae63fe7", // Petr Oliver (beta)
  tomas: "8c994d53-8cac-4e66-bc2d-1eaab54c327b", // Tomáš Protiva (beta)
};
const MEMBERS = {
  adam: "dd6765c2-eb97-43da-af54-b9ea189335b8", // Adam Rypl
  albert: "66e158bb-2f52-4d06-8f1f-79487c6f1201", // Albert Vízner
  jan: "a1f2fe51-c207-40a3-a25f-8d1ea0131e68", // Jan Smolík
  marie: "5e2fa850-1f31-4610-ab33-85acb9d1a26b", // Marie Benešová
  michaela: "269e34c3-8f04-4a68-a861-95b115e50fd1", // Michaela Ritterová
  natalie: "21c85f40-52d8-4839-93fa-05e799381e33", // Natálie Bendová
  annabela: "aa90f18e-fdef-4589-97e6-a0521912d8e9", // Annabela Šimková (beta)
  julie: "4056f252-0b8e-4435-be86-b03af8b261c6", // Julie Holá (beta)
};

// Stable ids make the seed idempotent (it deletes and re-inserts by event id).
const EVENT_IDS = {
  upcomingNone:
    "c1000000-0000-4000-8000-000000000001",
  startedPending:
    "c1000000-0000-4000-8000-000000000002",
  startedMissing:
    "c1000000-0000-4000-8000-000000000003",
  pastReflectionsOpen:
    "c1000000-0000-4000-8000-000000000004",
  pastComplete:
    "c1000000-0000-4000-8000-000000000005",
  upcomingPresentEmbargo:
    "c1000000-0000-4000-8000-000000000006",
};

const MINI_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0000000000\n%%EOF",
  "binary",
);

async function upload(bucket, path, data, contentType) {
  const { error } = await sb.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) console.warn(`upload ${path}: ${error.message}`);
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function daysFromNow(days) {
  return Date.now() + days * 86_400_000;
}

async function deleteEventRows(eventId) {
  await sb.from("birth_giving_team_members").delete().eq("event_id", eventId);
  await sb.from("birth_giving_teams").delete().eq("event_id", eventId);
  await sb.from("birth_giving_events").delete().eq("id", eventId);
}

function teamId(seq) {
  return `c2000000-0000-4000-8000-0000000000${String(seq).padStart(2, "0")}`;
}

function memberId(seq) {
  return `c3000000-0000-4000-8000-0000000000${String(seq).padStart(2, "0")}`;
}

async function insertEvent(event) {
  const { error } = await sb.from("birth_giving_events").insert(event);
  if (error) throw new Error(`event ${event.id}: ${error.message}`);
}

async function insertTeam(team) {
  const { error } = await sb.from("birth_giving_teams").insert(team);
  if (error) throw new Error(`team ${team.id}: ${error.message}`);
}

async function insertMembers(rows) {
  if (rows.length === 0) return;
  const { error } = await sb.from("birth_giving_team_members").insert(rows);
  if (error) throw new Error(`members: ${error.message}`);
}

async function main() {
  console.log("Seeding Birth Giving: Ondřej Kulhavý as attendee across states...");

  // ---------------------------------------------------------------- 1. upcoming, assignment none
  {
    const eventId = EVENT_IDS.upcomingNone;
    await deleteEventRows(eventId);
    await insertEvent({
      id: eventId,
      name: "Upcoming Design Sprint",
      customer: "ČZU Innovation Hub",
      starts_at: iso(daysFromNow(14)),
      duration: "24h",
      status: "published",
      organizer_profile_ids: [ORGANIZERS.anna],
      assignment_state: "none",
      removed_at: null,
      removed_by_profile_id: null,
      created_by_profile_id: ORGANIZERS.anna,
      updated_by_profile_id: ORGANIZERS.anna,
    });
    const t = teamId(1);
    await insertTeam({
      id: t,
      event_id: eventId,
      name: "Sprinters:ky",
      is_winner: false,
      result_state: "pending",
      result_files: [],
      created_by_profile_id: ORGANIZERS.anna,
      updated_by_profile_id: ORGANIZERS.anna,
    });
    await insertMembers([
      { id: memberId(1), event_id: eventId, team_id: t, profile_id: ONDREJ, created_by_profile_id: ORGANIZERS.anna, updated_by_profile_id: ORGANIZERS.anna },
      { id: memberId(2), event_id: eventId, team_id: t, profile_id: MEMBERS.adam, created_by_profile_id: ORGANIZERS.anna, updated_by_profile_id: ORGANIZERS.anna },
    ]);
    console.log("  [1] Upcoming Design Sprint (assignment none, results pending)");
  }

  // ---------------------------------------------------------------- 2. started, results pending
  {
    const eventId = EVENT_IDS.startedPending;
    await deleteEventRows(eventId);
    const assignmentPath = `birth-giving/assignments/${eventId}/zadani.pdf`;
    await upload("documents", assignmentPath, MINI_PDF, "application/pdf");
    await insertEvent({
      id: eventId,
      name: "Retail Data Battle",
      customer: "Globus ČR",
      starts_at: iso(daysFromNow(-1)),
      duration: "8h",
      status: "published",
      organizer_profile_ids: [ORGANIZERS.petr, ORGANIZERS.tomas],
      assignment_state: "present",
      assignment_storage_path: assignmentPath,
      assignment_file_name: "Retail-zadani.pdf",
      assignment_mime_type: "application/pdf",
      assignment_file_size: MINI_PDF.length,
      assignment_uploaded_at: iso(daysFromNow(-2)),
      assignment_uploaded_by_profile_id: ORGANIZERS.petr,
      removed_at: null,
      removed_by_profile_id: null,
      created_by_profile_id: ORGANIZERS.petr,
      updated_by_profile_id: ORGANIZERS.petr,
    });
    const t = teamId(2);
    await insertTeam({
      id: t,
      event_id: eventId,
      name: "Data Bees",
      is_winner: false,
      result_state: "pending",
      result_files: [],
      created_by_profile_id: ORGANIZERS.petr,
      updated_by_profile_id: ORGANIZERS.petr,
    });
    await insertMembers([
      { id: memberId(3), event_id: eventId, team_id: t, profile_id: ONDREJ, created_by_profile_id: ORGANIZERS.petr, updated_by_profile_id: ORGANIZERS.petr },
      { id: memberId(4), event_id: eventId, team_id: t, profile_id: MEMBERS.michaela, created_by_profile_id: ORGANIZERS.petr, updated_by_profile_id: ORGANIZERS.petr },
    ]);
    console.log("  [2] Retail Data Battle (assignment present, results still pending)");
  }

  // ---------------------------------------------------------------- 3. started, assignment missing
  {
    const eventId = EVENT_IDS.startedMissing;
    await deleteEventRows(eventId);
    await insertEvent({
      id: eventId,
      name: "Logistický hackathon",
      customer: "Zásilkovna",
      starts_at: iso(daysFromNow(-3)),
      duration: "8h",
      status: "published",
      organizer_profile_ids: [ORGANIZERS.tomas],
      assignment_state: "missing",
      removed_at: null,
      removed_by_profile_id: null,
      created_by_profile_id: ORGANIZERS.tomas,
      updated_by_profile_id: ORGANIZERS.tomas,
    });
    const t = teamId(3);
    await insertTeam({
      id: t,
      event_id: eventId,
      name: "Balíkoví jezdci",
      is_winner: false,
      result_state: "missing",
      result_files: [],
      created_by_profile_id: ORGANIZERS.tomas,
      updated_by_profile_id: ORGANIZERS.tomas,
    });
    await insertMembers([
      { id: memberId(5), event_id: eventId, team_id: t, profile_id: ONDREJ, created_by_profile_id: ORGANIZERS.tomas, updated_by_profile_id: ORGANIZERS.tomas },
      { id: memberId(6), event_id: eventId, team_id: t, profile_id: MEMBERS.jan, created_by_profile_id: ORGANIZERS.tomas, updated_by_profile_id: ORGANIZERS.tomas },
      { id: memberId(7), event_id: eventId, team_id: t, profile_id: MEMBERS.julie, created_by_profile_id: ORGANIZERS.tomas, updated_by_profile_id: ORGANIZERS.tomas },
    ]);
    console.log("  [3] Logistický hackathon (assignment missing)");
  }

  // ---------------------------------------------------------------- 4. past, winner, reflections partially open
  {
    const eventId = EVENT_IDS.pastReflectionsOpen;
    await deleteEventRows(eventId);
    const assignmentPath = `birth-giving/assignments/${eventId}/zadani.pdf`;
    await upload("documents", assignmentPath, MINI_PDF, "application/pdf");
    await insertEvent({
      id: eventId,
      name: "Foodtech Sprint 2026",
      customer: "Rohlík.cz",
      starts_at: iso(daysFromNow(-21)),
      duration: "24h",
      status: "published",
      organizer_profile_ids: [ORGANIZERS.anna, ORGANIZERS.petr],
      assignment_state: "present",
      assignment_storage_path: assignmentPath,
      assignment_file_name: "Foodtech-zadani.pdf",
      assignment_mime_type: "application/pdf",
      assignment_file_size: MINI_PDF.length,
      assignment_uploaded_at: iso(daysFromNow(-22)),
      assignment_uploaded_by_profile_id: ORGANIZERS.anna,
      removed_at: null,
      removed_by_profile_id: null,
      created_by_profile_id: ORGANIZERS.anna,
      updated_by_profile_id: ORGANIZERS.anna,
    });
    const winnerTeam = teamId(4);
    const resultPath = `birth-giving/results/${eventId}/${winnerTeam}/prezentace.pdf`;
    await upload("documents", resultPath, MINI_PDF, "application/pdf");
    await insertTeam({
      id: winnerTeam,
      event_id: eventId,
      name: "Food Ninjas (vítěz)",
      is_winner: true,
      result_state: "present",
      result_files: [
        {
          id: randomUUID(),
          storage_path: resultPath,
          original_file_name: "Prezentace.pdf",
          mime_type: "application/pdf",
          file_size: MINI_PDF.length,
          uploaded_at: iso(daysFromNow(-20)),
          uploaded_by_profile_id: MEMBERS.jan,
        },
      ],
      created_by_profile_id: ORGANIZERS.anna,
      updated_by_profile_id: ORGANIZERS.anna,
    });
    // Ondřej's reflection still open; Jan and Marie already submitted theirs.
    await insertMembers([
      {
        id: memberId(8), event_id: eventId, team_id: winnerTeam, profile_id: ONDREJ,
        reflection_contribution: null, reflection_learning: null, reflection_submitted_at: null,
        created_by_profile_id: ORGANIZERS.anna, updated_by_profile_id: ONDREJ,
      },
      {
        id: memberId(9), event_id: eventId, team_id: winnerTeam, profile_id: MEMBERS.jan,
        reflection_contribution: "Moderoval:a jsem finální prezentaci a připravil:a demo.",
        reflection_learning: "Naučil:a jsem se lépe pracovat s časovým limitem.",
        reflection_submitted_at: iso(daysFromNow(-19)),
        created_by_profile_id: ORGANIZERS.anna, updated_by_profile_id: MEMBERS.jan,
      },
      {
        id: memberId(10), event_id: eventId, team_id: winnerTeam, profile_id: MEMBERS.marie,
        reflection_contribution: "Navrhla jsem vizuální identitu a sestavila týmový zápis.",
        reflection_learning: "Příště bychom si měli rozdělit role dřív.",
        reflection_submitted_at: iso(daysFromNow(-19)),
        created_by_profile_id: ORGANIZERS.anna, updated_by_profile_id: MEMBERS.marie,
      },
    ]);
    console.log("  [4] Foodtech Sprint 2026 (winner, Ondřej's reflection still open)");
  }

  // ---------------------------------------------------------------- 5. past, all reflections complete
  {
    const eventId = EVENT_IDS.pastComplete;
    await deleteEventRows(eventId);
    const assignmentPath = `birth-giving/assignments/${eventId}/zadani.pdf`;
    await upload("documents", assignmentPath, MINI_PDF, "application/pdf");
    await insertEvent({
      id: eventId,
      name: "Green Energy Hackathon",
      customer: "ČEZ",
      starts_at: iso(daysFromNow(-120)),
      duration: "24h",
      status: "published",
      organizer_profile_ids: [ORGANIZERS.tomas],
      assignment_state: "present",
      assignment_storage_path: assignmentPath,
      assignment_file_name: "Green-zadani.pdf",
      assignment_mime_type: "application/pdf",
      assignment_file_size: MINI_PDF.length,
      assignment_uploaded_at: iso(daysFromNow(-121)),
      assignment_uploaded_by_profile_id: ORGANIZERS.tomas,
      removed_at: null,
      removed_by_profile_id: null,
      created_by_profile_id: ORGANIZERS.tomas,
      updated_by_profile_id: ORGANIZERS.tomas,
    });
    const t = teamId(5);
    const resultPath = `birth-giving/results/${eventId}/${t}/baterie.pdf`;
    await upload("documents", resultPath, MINI_PDF, "application/pdf");
    await insertTeam({
      id: t,
      event_id: eventId,
      name: "Voltíci",
      is_winner: true,
      result_state: "present",
      result_files: [
        {
          id: randomUUID(),
          storage_path: resultPath,
          original_file_name: "Bateriové-řešení.pdf",
          mime_type: "application/pdf",
          file_size: MINI_PDF.length,
          uploaded_at: iso(daysFromNow(-119)),
          uploaded_by_profile_id: MEMBERS.albert,
        },
      ],
      created_by_profile_id: ORGANIZERS.tomas,
      updated_by_profile_id: ORGANIZERS.tomas,
    });
    await insertMembers([
      {
        id: memberId(11), event_id: eventId, team_id: t, profile_id: ONDREJ,
        reflection_contribution: "Sestavil:a jsem simulaci spotřeby a připravil:a podklady pro prezentaci.",
        reflection_learning: "Ocenil:a jsem týmovou spolupráci napříč obory.",
        reflection_submitted_at: iso(daysFromNow(-118)),
        created_by_profile_id: ORGANIZERS.tomas, updated_by_profile_id: ONDREJ,
      },
      {
        id: memberId(12), event_id: eventId, team_id: t, profile_id: MEMBERS.albert,
        reflection_contribution: "Navrhl:a jsem nabíjecí stanici pro domácnosti.",
        reflection_learning: "Užitečné bylo testování prototypu na reálných datech.",
        reflection_submitted_at: iso(daysFromNow(-118)),
        created_by_profile_id: ORGANIZERS.tomas, updated_by_profile_id: MEMBERS.albert,
      },
      {
        id: memberId(13), event_id: eventId, team_id: t, profile_id: MEMBERS.natalie,
        reflection_contribution: "Zajišťovala jsem komunikaci se zadavateli.",
        reflection_learning: "Věřím, že dobře míněné role zlepší příští sprint.",
        reflection_submitted_at: iso(daysFromNow(-117)),
        created_by_profile_id: ORGANIZERS.tomas, updated_by_profile_id: MEMBERS.natalie,
      },
    ]);
    console.log("  [5] Green Energy Hackathon (Ondřej reflection submitted)");
  }

  // ---------------------------------------------------------------- 6. upcoming + assignment uploaded (embargo)
  {
    const eventId = EVENT_IDS.upcomingPresentEmbargo;
    await deleteEventRows(eventId);
    const assignmentPath = `birth-giving/assignments/${eventId}/zadani.pdf`;
    await upload("documents", assignmentPath, MINI_PDF, "application/pdf");
    await insertEvent({
      id: eventId,
      name: "AI Hackathon Praha",
      customer: "CzechInvest",
      starts_at: iso(daysFromNow(7)),
      duration: "24h",
      status: "published",
      organizer_profile_ids: [ORGANIZERS.petr],
      assignment_state: "present",
      assignment_storage_path: assignmentPath,
      assignment_file_name: "AI-zadani.pdf",
      assignment_mime_type: "application/pdf",
      assignment_file_size: MINI_PDF.length,
      assignment_uploaded_at: iso(daysFromNow(-1)),
      assignment_uploaded_by_profile_id: ORGANIZERS.petr,
      removed_at: null,
      removed_by_profile_id: null,
      created_by_profile_id: ORGANIZERS.petr,
      updated_by_profile_id: ORGANIZERS.petr,
    });
    const t = teamId(6);
    await insertTeam({
      id: t,
      event_id: eventId,
      name: "Prompt Wizards",
      is_winner: false,
      result_state: "pending",
      result_files: [],
      created_by_profile_id: ORGANIZERS.petr,
      updated_by_profile_id: ORGANIZERS.petr,
    });
    await insertMembers([
      { id: memberId(14), event_id: eventId, team_id: t, profile_id: ONDREJ, created_by_profile_id: ORGANIZERS.petr, updated_by_profile_id: ORGANIZERS.petr },
      { id: memberId(15), event_id: eventId, team_id: t, profile_id: MEMBERS.annabela, created_by_profile_id: ORGANIZERS.petr, updated_by_profile_id: ORGANIZERS.petr },
    ]);
    console.log("  [6] AI Hackathon Praha (assignment uploaded, embargoed until start)");
  }

  console.log("Seeding complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});