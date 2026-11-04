#!/usr/bin/env node
// One-off import of training sessions from an Airtable-style export into the
// local Supabase database.
//
// Input format (blocks separated by a blank line):
//   datum a čas
//   téma
//   tým
//   facilitátor:ka (0..n lines)
//   místnost ("D126 - vepředu" / "nevíme")
//   kapacita (ignored, see below)
//   přihlášené osoby (0..n lines)
//
// The capacity column is treated as the minimum: when more people signed up
// than the source capacity, `guest_capacity` is raised to the signup count.
// Everyone in the signup list is imported as a guest.
//
// Usage:
//   node scripts/import-training-sessions.mjs            # dry run
//   node scripts/import-training-sessions.mjs --apply    # write to local DB
//
// The local DB URL can be overridden with LOCAL_DATABASE_URL.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_PATH = path.resolve(__dirname, "data/training-sessions_input.txt");
const PROFILES_CSV_PATH = path.resolve(__dirname, "../data/profiles.csv");
const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:54322/postgres";
const SESSION_DURATION_MINUTES = 4 * 60;
const PRAGUE_TIME_ZONE = "Europe/Prague";
const SYSTEM_PROFILE_EMAIL = "admin@studenti.czu.cz";
const PLACEHOLDER_EMAIL_DOMAIN = "studenti.czu.cz";

const APPLY = process.argv.includes("--apply");
const DATABASE_URL = process.env.LOCAL_DATABASE_URL ?? DEFAULT_DATABASE_URL;

const ROOM_CODE_BY_LABEL = {
  "D126 - vepředu": "d126",
  "D132 - vzadu": "d132",
  "D226 - horní": "d226",
};

const DATE_LINE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/;
const CAPACITY_LINE_RE = /^\d+$/;

/** @param {string} content @returns {string[][]} */
function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const stripProgram = (name) => name.replace(/\s*\([^)]*\)\s*$/, "").trim();
const tokenKey = (name) => stripProgram(name).toLowerCase().split(/\s+/).sort().join(" ");

/** "Semanišin David" -> "David Semanišin" */
function toDisplayName(name) {
  const [surname, ...given] = stripProgram(name).split(/\s+/);
  return [...given, surname].join(" ");
}

function placeholderEmail(name) {
  const hash = crypto.createHash("sha1").update(tokenKey(name)).digest("hex").slice(0, 12);
  return `import.${hash}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function zonedTimeToUtc({ year, month, day, hour, minute }) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PRAGUE_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(guess)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offset = asUtc - guess.getTime();
  return new Date(guess.getTime() - offset);
}

/** @returns {{ startsAt: Date, endsAt: Date }} */
function parseDateTime(line) {
  const match = DATE_LINE_RE.exec(line);
  if (!match) {
    throw new Error(`Neplatný datum/čas: "${line}"`);
  }
  const [, day, month, year, hour, minute] = match;
  const startsAt = zonedTimeToUtc({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  });
  const endsAt = new Date(startsAt.getTime() + SESSION_DURATION_MINUTES * 60 * 1000);
  return { startsAt, endsAt };
}

/**
 * @typedef {Object} ParsedSession
 * @property {string} topic
 * @property {string} teamName
 * @property {Date} startsAt
 * @property {Date} endsAt
 * @property {string | null} roomCode
 * @property {string | null} locationNote
 * @property {number} sourceCapacity
 * @property {string[]} facilitators
 * @property {string[]} signups
 */

/** @param {string} content @returns {ParsedSession[]} */
function parseSessions(content) {
  return content
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines, index) => {
      const where = `blok ${index + 1}`;
      if (lines.length < 5) {
        throw new Error(`${where}: čekal jsem alespoň 5 řádků, mám ${lines.length}`);
      }
      const [dateLine, topic, teamName, ...rest] = lines;
      const capacityIndex = rest.findIndex((line) => CAPACITY_LINE_RE.test(line));
      if (capacityIndex === -1) {
        throw new Error(`${where} (${topic}): nenašel jsem číslo kapacity`);
      }
      const roomIndex = capacityIndex - 1;
      if (roomIndex < 0) {
        throw new Error(`${where} (${topic}): nenašel jsem řádek s místností`);
      }
      const roomLabel = rest[roomIndex];
      const capacityLine = rest[capacityIndex];
      const dateTime = parseDateTime(dateLine);
      return {
        ...dateTime,
        topic,
        teamName,
        roomCode: ROOM_CODE_BY_LABEL[roomLabel] ?? null,
        locationNote: ROOM_CODE_BY_LABEL[roomLabel] ? null : roomLabel,
        sourceCapacity: Number(capacityLine),
        facilitators: rest.slice(0, roomIndex),
        signups: rest.slice(roomIndex + 2),
      };
    });
}

async function loadKnownProfiles() {
  const content = await fs.readFile(PROFILES_CSV_PATH, "utf8");
  const [headerRow, ...rows] = parseCsv(content.replace(/^\uFEFF/, ""));
  const header = headerRow.map((column) => column.trim());
  const nameIndex = header.indexOf("name");
  const emailIndex = header.indexOf("work_email");
  const pictureIndex = header.indexOf("picture");
  const teamIndex = header.indexOf("team_id");
  const idIndex = header.indexOf("id");
  if (nameIndex === -1 || emailIndex === -1 || teamIndex === -1) {
    throw new Error("profiles.csv nemá očekávané sloupce (name, work_email, team_id)");
  }

  /** @type {Map<string, { id: string, name: string, email: string, picture: string | null, teamId: string | null }>} */
  const byName = new Map();
  for (const row of rows) {
    const name = row[nameIndex];
    if (!name) continue;
    const key = tokenKey(name);
    if (byName.has(key)) {
      console.warn(`⚠️  Duplicitní jméno v profiles.csv: "${name}" – používám první výskyt`);
      continue;
    }
    byName.set(key, {
      id: row[idIndex],
      name,
      email: row[emailIndex],
      picture: row[pictureIndex] || null,
      teamId: row[teamIndex] || null,
    });
  }
  return byName;
}

/** @param {ParsedSession[]} sessions @param {Map<string, any>} knownProfiles */
function resolvePeople(sessions, knownProfiles) {
  /** @type {Map<string, { name: string, email: string, picture: string | null, knownTeamId: string | null, teamName: string | null }>} */
  const people = new Map();
  const unmatched = new Set();

  const register = (rawName, teamName) => {
    const key = tokenKey(rawName);
    const existing = people.get(key);
    if (existing) {
      if (!existing.teamName && teamName) existing.teamName = teamName;
      return key;
    }
    const known = knownProfiles.get(key);
    if (!known) unmatched.add(rawName);
    people.set(key, {
      name: known?.name ?? toDisplayName(rawName),
      email: known?.email ?? placeholderEmail(rawName),
      picture: known?.picture ?? null,
      knownTeamId: known?.teamId ?? null,
      teamName: teamName ?? null,
    });
    return key;
  };

  for (const session of sessions) {
    for (const rawName of session.facilitators) register(rawName, session.teamName);
    for (const rawName of session.signups) register(rawName, null);
  }

  // Infer prod team UUID -> team name from facilitator appearances.
  /** @type {Map<string, Map<string, number>>} */
  const votes = new Map();
  for (const session of sessions) {
    for (const rawName of session.facilitators) {
      const person = people.get(tokenKey(rawName));
      if (!person?.knownTeamId) continue;
      const teamVotes = votes.get(person.knownTeamId) ?? new Map();
      teamVotes.set(session.teamName, (teamVotes.get(session.teamName) ?? 0) + 1);
      votes.set(person.knownTeamId, teamVotes);
    }
  }
  /** @type {Map<string, string>} */
  const teamNameByKnownTeamId = new Map();
  for (const [knownTeamId, teamVotes] of votes) {
    const [winner] = [...teamVotes.entries()].sort((a, b) => b[1] - a[1]);
    if (winner) teamNameByKnownTeamId.set(knownTeamId, winner[0]);
  }

  // A person who only signed up as a guest belongs to their real (prod) team.
  for (const person of people.values()) {
    if (person.teamName) continue;
    person.teamName = person.knownTeamId ? (teamNameByKnownTeamId.get(person.knownTeamId) ?? null) : null;
  }

  return { people, unmatched, teamNameByKnownTeamId };
}

function summarize(sessions, people, unmatched, teamNameByKnownTeamId) {
  console.log(`Session: ${sessions.length}`);
  console.log(`Týmy: ${[...new Set(sessions.map((s) => s.teamName))].join(", ")}`);
  console.log(`Lidé: ${people.size} (${unmatched.size} bez záznamu v profiles.csv)`);
  if (teamNameByKnownTeamId.size > 0) {
    console.log("Odvozené mapování produkčních týmů:");
    for (const [knownTeamId, teamName] of teamNameByKnownTeamId) {
      console.log(`  ${knownTeamId} -> ${teamName}`);
    }
  }
  const noFacilitators = sessions.filter((session) => session.facilitators.length === 0);
  if (noFacilitators.length > 0) {
    console.log(`⚠️  Bez facilitátora: ${noFacilitators.length}`);
    for (const session of noFacilitators) console.log(`   - ${session.topic}`);
  }
  const guests = sessions.reduce((sum, session) => sum + session.signups.length, 0);
  const overbooked = sessions.filter((session) => session.signups.length > session.sourceCapacity);
  console.log(`Přihlášení: ${guests}`);
  console.log(`Kapacita navýšená na počet přihlášených u ${overbooked.length} sessioní`);
}

async function main() {
  const [input, knownProfiles] = await Promise.all([
    fs.readFile(INPUT_PATH, "utf8"),
    loadKnownProfiles(),
  ]);
  const sessions = parseSessions(input);
  const { people, unmatched, teamNameByKnownTeamId } = resolvePeople(sessions, knownProfiles);
  summarize(sessions, people, unmatched, teamNameByKnownTeamId);

  if (unmatched.size > 0) {
    console.log("Nenalezení lidé (vytvoří se jako nový profil):");
    for (const name of [...unmatched].sort()) console.log(`  - ${name}`);
  }

  if (process.argv.includes("--dump")) {
    for (const session of sessions) {
      console.log(
        `\n${session.startsAt.toISOString()}–${session.endsAt.toISOString()} | ${session.teamName} | ${session.topic}` +
          ` | ${session.roomCode ?? session.locationNote} | kapacita ${Math.max(session.sourceCapacity, session.signups.length)}` +
          `\n  facilitace: ${session.facilitators.join(", ") || "—"}` +
          `\n  přihlášení: ${session.signups.join(", ") || "—"}`,
      );
    }
  }

  if (!APPLY) {
    console.log("\nDry run. Spusť s --apply pro zápis do lokální DB.");
    return;
  }

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");

    const system = await client.query("SELECT id FROM profiles WHERE work_email = $1", [
      SYSTEM_PROFILE_EMAIL,
    ]);
    if (system.rows.length === 0) {
      throw new Error(`Chybí systémový profil ${SYSTEM_PROFILE_EMAIL}`);
    }
    const systemProfileId = system.rows[0].id;

    const existing = await client.query("SELECT id, topic FROM training_sessions");
    console.log(`\nMažu ${existing.rowCount} existujících training sessions`);
    await client.query("DELETE FROM training_sessions");

    /** @type {Map<string, string>} */
    const teamIdByName = new Map();
    for (const teamName of new Set(sessions.map((session) => session.teamName))) {
      const inserted = await client.query(
        `INSERT INTO teams (name, created_by_profile_id, updated_by_profile_id)
         SELECT $1, $2, $2
         WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = $1)
         RETURNING id`,
        [teamName, systemProfileId],
      );
      if (inserted.rows.length > 0) {
        teamIdByName.set(teamName, inserted.rows[0].id);
      } else {
        const found = await client.query("SELECT id FROM teams WHERE name = $1", [teamName]);
        teamIdByName.set(teamName, found.rows[0].id);
      }
    }

    /** @type {Map<string, string>} */
    const profileIdByKey = new Map();
    for (const [key, person] of people) {
      const teamId = person.teamName ? (teamIdByName.get(person.teamName) ?? null) : null;
      const profile = await client.query(
        `INSERT INTO profiles (name, work_email, picture, team_id, role, created_by_profile_id, updated_by_profile_id)
         VALUES ($1, $2, $3, $4, 'student', $5, $5)
         ON CONFLICT (work_email) DO UPDATE
           SET name = EXCLUDED.name,
               picture = COALESCE(EXCLUDED.picture, profiles.picture),
               updated_at = now()
         RETURNING id`,
        [person.name, person.email, person.picture, teamId, systemProfileId],
      );
      profileIdByKey.set(key, profile.rows[0].id);
    }

    const roomRows = await client.query("SELECT id, code FROM rooms");
    const roomIdByCode = new Map(roomRows.rows.map((room) => [room.code, room.id]));

    let guestCount = 0;
    let facilitatorCount = 0;
    for (const session of sessions) {
      const teamId = teamIdByName.get(session.teamName);
      if (!teamId) throw new Error(`Neznámý tým ${session.teamName}`);
      const roomId = session.roomCode ? (roomIdByCode.get(session.roomCode) ?? null) : null;
      if (session.roomCode && !roomId) throw new Error(`Neznámá místnost ${session.roomCode}`);

      const inserted = await client.query(
        `INSERT INTO training_sessions
           (team_id, topic, starts_at, ends_at, room_id, location_note, guest_capacity, created_by_profile_id, updated_by_profile_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING id`,
        [
          teamId,
          session.topic,
          session.startsAt,
          session.endsAt,
          roomId,
          session.locationNote,
          Math.max(session.sourceCapacity, session.signups.length),
          systemProfileId,
        ],
      );
      const sessionId = inserted.rows[0].id;

      const facilitatorIds = new Set();
      for (const rawName of session.facilitators) {
        const profileId = profileIdByKey.get(tokenKey(rawName));
        if (!profileId || facilitatorIds.has(profileId)) continue;
        facilitatorIds.add(profileId);
        await client.query(
          `INSERT INTO training_session_facilitators (training_session_id, profile_id, created_by_profile_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [sessionId, profileId, systemProfileId],
        );
        facilitatorCount += 1;
      }

      const guestIds = new Set();
      for (const rawName of session.signups) {
        const profileId = profileIdByKey.get(tokenKey(rawName));
        if (!profileId || guestIds.has(profileId)) continue;
        guestIds.add(profileId);
        await client.query(
          `INSERT INTO training_session_guests (training_session_id, profile_id, joined_at)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [sessionId, profileId, new Date(session.startsAt.getTime() - 24 * 60 * 60 * 1000)],
        );
        guestCount += 1;
      }
    }

    await client.query("COMMIT");
    console.log(
      `\n✅ Import hotov: ${sessions.length} sessioní, ${teamIdByName.size} týmů, ${people.size} profilů, ${facilitatorCount} facilitátor:ek, ${guestCount} přihlášených.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\n❌ Import selhal: ${error.message}`);
  process.exitCode = 1;
});
