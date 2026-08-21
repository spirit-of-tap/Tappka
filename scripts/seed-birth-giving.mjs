// Idempotent local-dev seed for Birth Giving (issue #54).
// Inserts example data at several lifecycle stages and uploads tiny real files
// so downloads render. Run against the local Supabase stack:
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

// Ondřej Kulhavý — the demo user. Made an organizer on every event so all of
// them are visible to him in the UI (published + drafts via organizer RLS).
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

// Demo events are organized by Marie so Ondřej experiences them as a pure
// participant (he is verified community, so he still sees all published ones).
const MARIE = PARTICIPANTS.marie;

// Matches the DB CHECK constraints in db/schema/birth-giving.ts exactly.
function norm(value) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

// ---- tiny real files -------------------------------------------------------
// Minimal but valid PDF and a 1x1 PNG, so the UI can sign/download them.
const MINI_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0000000000\n%%EOF",
  "binary",
);
const MINI_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
  "base64",
);

async function upload(bucket, path, data, contentType) {
  const { error } = await sb.storage
    .from(bucket)
    .upload(path, data, {
      contentType,
      upsert: true,
      metadata: { size: data.length, mimetype: contentType },
    });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

function iso(date) {
  return new Date(date).toISOString();
}

// ---- helpers ---------------------------------------------------------------
async function insert(table, rows) {
  const batch = await sb.from(table).insert(rows);
  if (batch.error) throw new Error(`${table}: ${batch.error.message}\n${batch.error.details ?? ""}`);
  return batch;
}

async function eventExists(name, customer, startsAt) {
  // Match by normalized name + customer only: starts_at is recomputed from
  // "now" on every run, so it must not participate in the identity match.
  const { data, error } = await sb
    .from("birth_giving_events")
    .select("id")
    .eq("normalized_name", norm(name))
    .eq("normalized_customer", norm(customer))
    .maybeSingle();
  if (error) throw new Error(`eventExists: ${error.message}`);
  return data;
}

async function stageSeeded(name, customer) {
  return Boolean(await eventExists(name, customer));
}

async function seedEvent({
  name,
  customer,
  daysFromNow,
  duration,
  minTeam,
  maxTeam,
  joiningOpen,
  status,
  startedAt,
  organizer = DEMO,
}) {
  const startsAt = iso(Date.now() + daysFromNow * 86_400_000);
  const existing = await eventExists(name, customer, startsAt);
  if (existing) {
    console.log(`skip (exists): ${name}`);
    return existing.id;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const processedAt = status === "published" && startedAt ? iso(Date.now() + daysFromNow * 86_400_000) : null;

  const { error: eErr } = await sb.from("birth_giving_events").insert({
    id,
    name,
    normalized_name: norm(name),
    customer,
    normalized_customer: norm(customer),
    starts_at: startsAt,
    duration,
    minimum_team_size: minTeam,
    maximum_team_size: maxTeam,
    joining_open: joiningOpen,
    status,
    start_processed_at: processedAt,
    start_emails_queued_at: null,
    removed_at: null,
    removed_by_profile_id: null,
    created_at: now,
    updated_at: now,
    created_by_profile_id: organizer,
    updated_by_profile_id: organizer,
  });
  if (eErr) throw new Error(`events: ${eErr.message} ${eErr.details ?? ""}`);

  await insert("birth_giving_event_organizers", [{
    event_id: id,
    profile_id: organizer,
    created_at: now,
    updated_at: now,
    created_by_profile_id: organizer,
    updated_by_profile_id: organizer,
  }]);

  console.log(`created: ${name} (${id})`);
  return id;
}

async function addTeam({ eventId, teamName }) {
  const id = randomUUID();
  const by = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by_profile_id: DEMO, updated_by_profile_id: DEMO };
  const { error } = await sb.from("birth_giving_teams").insert({
    id,
    event_id: eventId,
    name: teamName,
    status: "forming",
    result_state: "pending",
    cancelled_at: null,
    cancellation_reason: null,
    ...by,
  });
  if (error) throw new Error(`teams: ${error.message}`);
  return id;
}

async function confirmTeam({ eventId, teamId, status, members, frozen }) {
  const now = new Date().toISOString();
  const { error: tErr } = await sb
    .from("birth_giving_teams")
    .update({ status, updated_at: now, updated_by_profile_id: DEMO })
    .eq("id", teamId);
  if (tErr) throw new Error(`team update: ${tErr.message}`);

  for (const profileId of members) {
    const { error } = await sb.from("birth_giving_team_members").insert({
      id: randomUUID(),
      event_id: eventId,
      team_id: teamId,
      profile_id: profileId,
      confirmed_at: now,
      frozen_at: frozen ? now : null,
      created_at: now,
      updated_at: now,
      created_by_profile_id: DEMO,
      updated_by_profile_id: DEMO,
    });
    if (error) throw new Error(`team_members: ${error.message}`);
  }
}

async function addAssignment({ eventId, fileName, label }) {
  const objectPath = `birth-giving/${eventId}/assignment/${fileName}`;
  await upload("documents", objectPath, MINI_PDF, "application/pdf");
  const now = new Date().toISOString();
  const { error } = await sb.from("birth_giving_assignments").insert({
    event_id: eventId,
    state: "present",
    replacement_id: randomUUID(),
    storage_path: objectPath,
    original_file_name: `${label}.pdf`,
    mime_type: "application/pdf",
    file_size: MINI_PDF.length,
    uploaded_by_profile_id: DEMO,
    uploaded_at: now,
    created_at: now,
    updated_at: now,
    created_by_profile_id: DEMO,
    updated_by_profile_id: DEMO,
  });
  if (error) throw new Error(`assignments: ${error.message}`);
}

async function addResultFile({ eventId, teamId, fileName, data, contentType, label, uploader }) {
  const objectPath = `birth-giving/${eventId}/teams/${teamId}/${fileName}`;
  await upload("documents", objectPath, data, contentType);
  const now = new Date().toISOString();
  const { error } = await sb.from("birth_giving_team_result_files").insert({
    id: randomUUID(),
    event_id: eventId,
    team_id: teamId,
    storage_path: objectPath,
    original_file_name: label,
    mime_type: contentType,
    file_size: data.length,
    uploaded_by_profile_id: uploader,
    uploaded_at: now,
    removed_at: null,
    removed_by_profile_id: null,
    created_at: now,
    updated_at: now,
    created_by_profile_id: uploader,
    updated_by_profile_id: uploader,
  });
  if (error) throw new Error(`team_result_files: ${error.message}`);
}

function addReflectionRows({ eventId, teamId, profileId }) {
  return {
    id: randomUUID(),
    event_id: eventId,
    profile_id: profileId,
    contribution: "Koordinoval/a jsem rozdělení úkolů v týmu a zajistil/a finální odevzdání výsledků.",
    learning: "Naučil/a jsem se, jak důležitá je jasná komunikace a pravidelné check-iny při práci pod tlakem.",
    removed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by_profile_id: profileId,
    updated_by_profile_id: profileId,
  };
}

// ---- STAGE A: published upcoming, formation OPEN --------------------------
// See an open card, two forming teams, profiles "looking for team", a pending
// join request to approve, and a pending invitation to accept.
async function stageA() {
  if (await stageSeeded("BG Sprint: Brandová strategie", "ČZU Marketing")) return;
  const eventId = await seedEvent({
    name: "BG Sprint: Brandová strategie",
    customer: "ČZU Marketing",
    daysFromNow: +18,
    duration: "8h",
    minTeam: 2,
    maxTeam: 4,
    joiningOpen: true,
    status: "published",
    organizer: MARIE,
  });

  const teamAlpha = await addTeam({ eventId, teamName: "Tým Alfa" });
  const teamBeta = await addTeam({ eventId, teamName: "Tým Beta" });
  await confirmTeam({ eventId, teamId: teamAlpha, status: "forming", members: [DEMO, PARTICIPANTS.albert] });
  await confirmTeam({ eventId, teamId: teamBeta, status: "forming", members: [PARTICIPANTS.michaela, PARTICIPANTS.zuzana] });

  const now = new Date().toISOString();
  // Natálie wants to join Tým Beta (join request) — anyone on Tým Beta can approve.
  await insert("birth_giving_team_proposals", [{
    id: randomUUID(),
    event_id: eventId,
    team_id: teamBeta,
    candidate_profile_id: PARTICIPANTS.natalie,
    initiated_by_profile_id: PARTICIPANTS.natalie,
    direction: "join_request",
    state: "pending",
    resolved_by_profile_id: null,
    resolved_at: null,
    created_at: now,
    updated_at: now,
    created_by_profile_id: PARTICIPANTS.natalie,
    updated_by_profile_id: PARTICIPANTS.natalie,
  }]);
  // Ondřej invites Adam to Tým Alfa (invitation) — Adam must accept.
  await insert("birth_giving_team_proposals", [{
    id: randomUUID(),
    event_id: eventId,
    team_id: teamAlpha,
    candidate_profile_id: PARTICIPANTS.adam,
    initiated_by_profile_id: DEMO,
    direction: "invitation",
    state: "pending",
    resolved_by_profile_id: null,
    resolved_at: null,
    created_at: now,
    updated_at: now,
    created_by_profile_id: DEMO,
    updated_by_profile_id: DEMO,
  }]);
  // Adam + Marie are looking for a team.
  await insert("birth_giving_looking_for_team", [
    { event_id: eventId, profile_id: PARTICIPANTS.adam, created_at: now, updated_at: now, created_by_profile_id: PARTICIPANTS.adam, updated_by_profile_id: PARTICIPANTS.adam },
    { event_id: eventId, profile_id: PARTICIPANTS.marie, created_at: now, updated_at: now, created_by_profile_id: PARTICIPANTS.marie, updated_by_profile_id: PARTICIPANTS.marie },
  ]);
}

// ---- STAGE B: published upcoming, joining CLOSED, assignment pre-release ---
// Closed formation + assignment uploaded but only released at starts_at (3 days),
// so the assignment panel shows the countdown.
async function stageB() {
  if (await stageSeeded("BG Víkend: Datová akademie", "ČZU Informatika")) return;
  const eventId = await seedEvent({
    name: "BG Víkend: Datová akademie",
    customer: "ČZU Informatika",
    daysFromNow: +3,
    duration: "24h",
    minTeam: 2,
    maxTeam: 4,
    joiningOpen: false,
    status: "published",
    organizer: MARIE,
  });
  const teamGamma = await addTeam({ eventId, teamName: "Tým Gama" });
  const teamDelta = await addTeam({ eventId, teamName: "Tým Delta" });
  await confirmTeam({ eventId, teamId: teamGamma, status: "forming", members: [DEMO, PARTICIPANTS.albert, PARTICIPANTS.jan] });
  await confirmTeam({ eventId, teamId: teamDelta, status: "forming", members: [PARTICIPANTS.michaela, PARTICIPANTS.zuzana] });
  await addAssignment({ eventId, fileName: "zadani-akademie.pdf", label: "zadani-akademie" });
}

// ---- STAGE C: ended historical event with results + reflections ------------
// Seed for the Historie tab and Ondřej's profile participation count.
async function stageC() {
  if (await stageSeeded("BG: Výzkum uživatelského chování", "Katedra marketingu")) return;
  const eventId = await seedEvent({
    name: "BG: Výzkum uživatelského chování",
    customer: "Katedra marketingu",
    daysFromNow: -40,
    duration: "24h",
    minTeam: 2,
    maxTeam: 5,
    joiningOpen: false,
    status: "published",
    startedAt: true,
    organizer: MARIE,
  });

  const teamEpsilon = await addTeam({ eventId, teamName: "Tým Epsilon" });
  const teamZeta = await addTeam({ eventId, teamName: "Tým Zéta" });
  await confirmTeam({ eventId, teamId: teamEpsilon, status: "confirmed", frozen: true, members: [DEMO, PARTICIPANTS.albert, PARTICIPANTS.jan] });
  await confirmTeam({ eventId, teamId: teamZeta, status: "confirmed", frozen: true, members: [PARTICIPANTS.michaela, PARTICIPANTS.zuzana, PARTICIPANTS.marie] });

  await addAssignment({ eventId, fileName: "zadani-vyzkum.pdf", label: "zadani-vyzkum" });

  // Every team is 'present' and needs at least one result file.
  await addResultFile({
    eventId,
    teamId: teamEpsilon,
    fileName: "analyza.pdf",
    data: MINI_PDF,
    contentType: "application/pdf",
    label: "analyza-prezentace.pdf",
    uploader: PARTICIPANTS.albert,
  });
  await addResultFile({
    eventId,
    teamId: teamZeta,
    fileName: "graf.png",
    data: MINI_PNG,
    contentType: "image/png",
    label: "grafy.png",
    uploader: PARTICIPANTS.michaela,
  });
  await sb
    .from("birth_giving_teams")
    .update({ result_state: "present", updated_at: new Date().toISOString(), updated_by_profile_id: DEMO })
    .in("id", [teamEpsilon, teamZeta]);

  const reflections = [
    addReflectionRows({ eventId, profileId: DEMO }),
    addReflectionRows({ eventId, profileId: PARTICIPANTS.albert }),
    addReflectionRows({ eventId, profileId: PARTICIPANTS.michaela }),
    addReflectionRows({ eventId, profileId: PARTICIPANTS.zuzana }),
  ];
  await insert("birth_giving_reflections", reflections);
}

// ---- STAGE D: published upcoming, OPEN — Ondřej looks for a team ----------
// Ondřej is the organizer but NOT a team member here, so he can see the
// "Hledám tým" panel with himself listed among others, plus a pending
// invitation he can accept.
async function stageD() {
  if (await stageSeeded("BG Den: Týmový hackathon", "ČZU podnikatelé")) return;
  const eventId = await seedEvent({
    name: "BG Den: Týmový hackathon",
    customer: "ČZU podnikatelé",
    daysFromNow: +10,
    duration: "8h",
    minTeam: 2,
    maxTeam: 4,
    joiningOpen: true,
    status: "published",
    organizer: MARIE,
  });
  const teamSever = await addTeam({ eventId, teamName: "Tým Sever" });
  const teamJih = await addTeam({ eventId, teamName: "Tým Jih" });
  await confirmTeam({ eventId, teamId: teamSever, status: "forming", members: [PARTICIPANTS.albert, PARTICIPANTS.jan] });
  await confirmTeam({ eventId, teamId: teamJih, status: "forming", members: [PARTICIPANTS.michaela, PARTICIPANTS.zuzana] });

  const now = new Date().toISOString();
  // Ondřej + two others are looking for a team.
  await insert("birth_giving_looking_for_team", [
    { event_id: eventId, profile_id: DEMO, created_at: now, updated_at: now, created_by_profile_id: DEMO, updated_by_profile_id: DEMO },
    { event_id: eventId, profile_id: PARTICIPANTS.natalie, created_at: now, updated_at: now, created_by_profile_id: PARTICIPANTS.natalie, updated_by_profile_id: PARTICIPANTS.natalie },
    { event_id: eventId, profile_id: PARTICIPANTS.marie, created_at: now, updated_at: now, created_by_profile_id: PARTICIPANTS.marie, updated_by_profile_id: PARTICIPANTS.marie },
  ]);
  // Tým Sever (Albert) invites Ondřej — Ondřej can accept to join.
  await insert("birth_giving_team_proposals", [{
    id: randomUUID(),
    event_id: eventId,
    team_id: teamSever,
    candidate_profile_id: DEMO,
    initiated_by_profile_id: PARTICIPANTS.albert,
    direction: "invitation",
    state: "pending",
    resolved_by_profile_id: null,
    resolved_at: null,
    created_at: now,
    updated_at: now,
    created_by_profile_id: PARTICIPANTS.albert,
    updated_by_profile_id: PARTICIPANTS.albert,
  }]);
}

// ---- STAGE E: participant perspective (Ondřej is NOT the organizer) -------
// Organizer is Marie, so Ondřej sees only participant controls: accepted
// invitation, waiting join request, waiting for the assignment, and an active BG.
async function stageE() {
  if (await stageSeeded("BG Sprint: Klient Filip", "ČZU komunikace")) return;
  // E1 — Ondřej was INVITED into a team (pending invitation to accept).
  {
    const eventId = await seedEvent({
      name: "BG Sprint: Klient Filip",
      customer: "ČZU komunikace",
      daysFromNow: +14,
      duration: "8h",
      minTeam: 2,
      maxTeam: 4,
      joiningOpen: true,
      status: "published",
      organizer: MARIE,
    });
    const team = await addTeam({ eventId, teamName: "Tým Amber" });
    await confirmTeam({ eventId, teamId: team, status: "forming", members: [PARTICIPANTS.albert, PARTICIPANTS.jan] });
    const now = new Date().toISOString();
    await insert("birth_giving_team_proposals", [{
      id: randomUUID(),
      event_id: eventId,
      team_id: team,
      candidate_profile_id: DEMO,
      initiated_by_profile_id: PARTICIPANTS.albert,
      direction: "invitation",
      state: "pending",
      resolved_by_profile_id: null,
      resolved_at: null,
      created_at: now,
      updated_at: now,
      created_by_profile_id: PARTICIPANTS.albert,
      updated_by_profile_id: PARTICIPANTS.albert,
    }]);
  }

  // E2 — Ondřej is TRYING to get into a team (join request awaiting approval).
  {
    const eventId = await seedEvent({
      name: "BG Den: Inovační workshop",
      customer: "ČZU inovace",
      daysFromNow: +12,
      duration: "8h",
      minTeam: 2,
      maxTeam: 4,
      joiningOpen: true,
      status: "published",
      organizer: MARIE,
    });
    const team = await addTeam({ eventId, teamName: "Tým Jade" });
    await confirmTeam({ eventId, teamId: team, status: "forming", members: [PARTICIPANTS.michaela, PARTICIPANTS.zuzana] });
    const now = new Date().toISOString();
    await insert("birth_giving_team_proposals", [{
      id: randomUUID(),
      event_id: eventId,
      team_id: team,
      candidate_profile_id: DEMO,
      initiated_by_profile_id: DEMO,
      direction: "join_request",
      state: "pending",
      resolved_by_profile_id: null,
      resolved_at: null,
      created_at: now,
      updated_at: now,
      created_by_profile_id: DEMO,
      updated_by_profile_id: DEMO,
    }]);
    // Ondřej is also visible in the "looking for a team" list.
    await insert("birth_giving_looking_for_team", [{
      event_id: eventId,
      profile_id: DEMO,
      created_at: now,
      updated_at: now,
      created_by_profile_id: DEMO,
      updated_by_profile_id: DEMO,
    }]);
  }

  // E3 — Ondřej is confirmed in a team, WAITING FOR THE ZADÁNÍ (no assignment yet).
  {
    const eventId = await seedEvent({
      name: "BG Víkend: Design sprint",
      customer: "ČZU design",
      daysFromNow: +5,
      duration: "24h",
      minTeam: 2,
      maxTeam: 4,
      joiningOpen: false,
      status: "published",
      organizer: MARIE,
    });
    const team = await addTeam({ eventId, teamName: "Tým Lumen" });
    await confirmTeam({ eventId, teamId: team, status: "forming", members: [DEMO, PARTICIPANTS.albert, PARTICIPANTS.jan] });
  }

  // E4 — BG HAS STARTED: assignment released, teams frozen & running, Ondřej a member.
  {
    const eventId = await seedEvent({
      name: "BG: Marketingová kampaň",
      customer: "ČZU média",
      daysFromNow: -2,
      duration: "24h",
      minTeam: 2,
      maxTeam: 4,
      joiningOpen: false,
      status: "published",
      startedAt: true,
      organizer: MARIE,
    });
    const team = await addTeam({ eventId, teamName: "Tým Nápad" });
    await confirmTeam({ eventId, teamId: team, status: "confirmed", members: [DEMO, PARTICIPANTS.albert, PARTICIPANTS.jan], frozen: true });
    await addAssignment({ eventId, fileName: "zadani-kampan.pdf", label: "zadani-kampan" });
    await addResultFile({
      eventId,
      teamId: team,
      fileName: "navrh.pdf",
      data: MINI_PDF,
      contentType: "application/pdf",
      label: "navrh-plakatu.pdf",
      uploader: PARTICIPANTS.albert,
    });
    await sb
      .from("birth_giving_teams")
      .update({ result_state: "present", updated_at: new Date().toISOString(), updated_by_profile_id: MARIE })
      .eq("id", team);
    await insert("birth_giving_reflections", [{
      id: randomUUID(),
      event_id: eventId,
      profile_id: DEMO,
      contribution: "Koordinoval/a jsem rozdělení úkolů v týmu a zajistil/a finální odevzdání výsledků.",
      learning: "Naučil/a jsem se, jak důležitá je jasná komunikace a pravidelné check-iny při práci pod tlakem.",
      removed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_profile_id: DEMO,
      updated_by_profile_id: DEMO,
    }]);
  }
}

await stageA();
await stageB();
await stageC();
await stageD();
await stageE();
console.log("Seed complete.");
