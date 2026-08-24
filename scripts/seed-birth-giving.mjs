// Idempotent local-dev seed for Birth Giving.
// Run against the local Supabase stack:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-birth-giving.mjs
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

const DEMO = "d2be22a5-28b3-416b-b39a-156bf7bf1aeb";
const PARTICIPANTS = {
  albert: "66e158bb-2f52-4d06-8f1f-79487c6f1201",
  jan: "a1f2fe51-c207-40a3-a25f-8d1ea0131e68",
  michaela: "269e34c3-8f04-4a68-a861-95b115e50fd1",
  zuzana: "74ad6244-ce0d-46bf-ac4a-3415379f29b6",
  natalie: "21c85f40-52d8-4839-93fa-05e799381e33",
  adam: "dd6765c2-eb97-43da-af54-b9ea189335b8",
  marie: "5e2fa850-1f31-4610-ab33-85acb9d1a26b",
};

const MINI_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0000000000\n%%EOF",
  "binary",
);

async function upload(bucket, path, data, contentType) {
  const { error } = await sb.storage
    .from(bucket)
    .upload(path, data, {
      contentType,
      upsert: true,
    });
  if (error) console.warn(`upload ${path}: ${error.message}`);
}

function iso(date) {
  return new Date(date).toISOString();
}

async function main() {
  console.log("Seeding simplified Birth Giving events...");
  const now = Date.now();

  // 1. Nadcházející událost: Smart City Hackathon
  const upcomingStartsAt = iso(now + 7 * 86_400_000);
  const event1Id = randomUUID();
  const assignment1Path = `birth-giving/assignments/${event1Id}/zadani.pdf`;
  await upload("documents", assignment1Path, MINI_PDF, "application/pdf");

  const { error: e1Err } = await sb.from("birth_giving_events").insert({
    id: event1Id,
    name: "Smart City Hackathon",
    customer: "Magistrát hl. m. Prahy",
    starts_at: upcomingStartsAt,
    duration: "24h",
    status: "published",
    organizer_profile_ids: [DEMO, PARTICIPANTS.marie],
    assignment_state: "present",
    assignment_storage_path: assignment1Path,
    assignment_file_name: "Zadani-Smart-City.pdf",
    assignment_mime_type: "application/pdf",
    assignment_file_size: MINI_PDF.length,
    assignment_uploaded_at: new Date().toISOString(),
    assignment_uploaded_by_profile_id: DEMO,
    created_by_profile_id: DEMO,
    updated_by_profile_id: DEMO,
  });
  if (e1Err) console.warn("Event 1 error:", e1Err);

  // Teams for event 1
  const team1Id = randomUUID();
  await sb.from("birth_giving_teams").insert({
    id: team1Id,
    event_id: event1Id,
    name: "Prague Mobility Team",
    is_winner: false,
    result_state: "pending",
    result_files: [],
    created_by_profile_id: DEMO,
    updated_by_profile_id: DEMO,
  });
  await sb.from("birth_giving_team_members").insert([
    { event_id: event1Id, team_id: team1Id, profile_id: DEMO, created_by_profile_id: DEMO, updated_by_profile_id: DEMO },
    { event_id: event1Id, team_id: team1Id, profile_id: PARTICIPANTS.albert, created_by_profile_id: DEMO, updated_by_profile_id: DEMO },
    { event_id: event1Id, team_id: team1Id, profile_id: PARTICIPANTS.jan, created_by_profile_id: DEMO, updated_by_profile_id: DEMO },
  ]);

  const team2Id = randomUUID();
  await sb.from("birth_giving_teams").insert({
    id: team2Id,
    event_id: event1Id,
    name: "Green Lights",
    is_winner: false,
    result_state: "pending",
    result_files: [],
    created_by_profile_id: PARTICIPANTS.michaela,
    updated_by_profile_id: PARTICIPANTS.michaela,
  });
  await sb.from("birth_giving_team_members").insert([
    { event_id: event1Id, team_id: team2Id, profile_id: PARTICIPANTS.michaela, created_by_profile_id: PARTICIPANTS.michaela, updated_by_profile_id: PARTICIPANTS.michaela },
    { event_id: event1Id, team_id: team2Id, profile_id: PARTICIPANTS.zuzana, created_by_profile_id: PARTICIPANTS.michaela, updated_by_profile_id: PARTICIPANTS.michaela },
  ]);

  // 2. Historická událost s vítězem a reflexemi: Fintech Innovation Sprint
  const pastStartsAt = iso(now - 14 * 86_400_000);
  const event2Id = randomUUID();
  const assignment2Path = `birth-giving/assignments/${event2Id}/fintech-spec.pdf`;
  await upload("documents", assignment2Path, MINI_PDF, "application/pdf");

  const team3Id = randomUUID();
  const result1Path = `birth-giving/results/${event2Id}/${team3Id}/vysledky-prezentace.pdf`;
  await upload("documents", result1Path, MINI_PDF, "application/pdf");

  await sb.from("birth_giving_events").insert({
    id: event2Id,
    name: "Fintech Innovation Sprint",
    customer: "Komerční banka",
    starts_at: pastStartsAt,
    duration: "8h",
    status: "published",
    organizer_profile_ids: [DEMO, PARTICIPANTS.marie],
    assignment_state: "present",
    assignment_storage_path: assignment2Path,
    assignment_file_name: "Fintech-Assignment.pdf",
    assignment_mime_type: "application/pdf",
    assignment_file_size: MINI_PDF.length,
    assignment_uploaded_at: pastStartsAt,
    assignment_uploaded_by_profile_id: DEMO,
    created_by_profile_id: DEMO,
    updated_by_profile_id: DEMO,
  });

  await sb.from("birth_giving_teams").insert({
    id: team3Id,
    event_id: event2Id,
    name: "FinTech Ninjas (Vítěz)",
    is_winner: true,
    result_state: "present",
    result_files: [
      {
        id: randomUUID(),
        storage_path: result1Path,
        original_file_name: "Prezentace-a-Demo.pdf",
        mime_type: "application/pdf",
        file_size: MINI_PDF.length,
        uploaded_at: pastStartsAt,
        uploaded_by_profile_id: DEMO,
      },
    ],
    created_by_profile_id: DEMO,
    updated_by_profile_id: DEMO,
  });

  await sb.from("birth_giving_team_members").insert([
    {
      event_id: event2Id,
      team_id: team3Id,
      profile_id: DEMO,
      reflection_contribution: "Vytvořil:a jsem prototyp platební brány a integroval:a API banky.",
      reflection_learning: "Naučil:a jsem se efektivně pracovat pod časovým tlakem 8h sprintu.",
      reflection_submitted_at: iso(now - 13 * 86_400_000),
      created_by_profile_id: DEMO,
      updated_by_profile_id: DEMO,
    },
    {
      event_id: event2Id,
      team_id: team3Id,
      profile_id: PARTICIPANTS.adam,
      reflection_contribution: "Navrhl:a jsem UI/UX pro mobilní aplikaci a připravil:a finální prezentaci.",
      reflection_learning: "Příště bychom měli věnovat více času user testování před samotným odevzdáním.",
      reflection_submitted_at: iso(now - 13 * 86_400_000),
      created_by_profile_id: DEMO,
      updated_by_profile_id: DEMO,
    },
  ]);

  console.log("Seeding complete!");
}

main().catch(console.error);
