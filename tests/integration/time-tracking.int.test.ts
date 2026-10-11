import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";

// Postgres SQLSTATE codes surfaced by `pg` as `error.code`.
const UNIQUE_VIOLATION = "23505";
const EXCLUSION_VIOLATION = "23P01";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const INSUFFICIENT_PRIVILEGE = "42501";

const HOUR_MS = 3_600_000;

async function seedTeam(client: PoolClient, name: string): Promise<string> {
  const { rows } = await client.query(
    `insert into public.teams (name) values ($1) returning id`,
    [name],
  );
  return rows[0].id as string;
}

// profiles has an update trigger (validate_picture_only_update) that blocks
// changing role/team_id after the fact, so the profile is inserted complete.
async function seedMember(
  client: PoolClient,
  opts: { teamId?: string | null; role?: "student" | "coach" | "admin" } = {},
) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    `update public.users set verified_work_email = google_email, verified_work_email_at = now()
     where auth_user_id = $1 returning id`,
    [auth.id],
  );
  const { rows: profileRows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, role, team_id, beta_access_granted_at)
     values ($1, $2, $3, $4, $5, now()) returning id`,
    [`Člen ${auth.email}`, `tt-${auth.id}@studenti.czu.cz`, userRows[0].id, opts.role ?? "student", opts.teamId ?? null],
  );
  return { authUserId: auth.id, profileId: profileRows[0].id as string };
}

async function insertClosedEntry(
  client: PoolClient,
  profileId: string,
  startedAt: string,
  endedAt: string,
  extra: { direction?: string; tagId?: string | null; title?: string | null } = {},
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.time_entries
       (profile_id, direction, tag_id, title, started_at, ended_at, duration_ms, source,
        created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz,
             (extract(epoch from ($6::timestamptz - $5::timestamptz)) * 1000)::bigint, 'manual', $1, $1)
     returning id`,
    [profileId, extra.direction ?? "practise", extra.tagId ?? null, extra.title ?? null, startedAt, endedAt],
  );
  return rows[0].id as string;
}

async function insertTeamTag(
  client: PoolClient,
  teamId: string,
  creatorId: string,
  direction: string,
  name: string,
): Promise<string> {
  const { rows } = await client.query(
    `insert into public.time_tags (team_id, direction, name, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $4) returning id`,
    [teamId, direction, name, creatorId],
  );
  return rows[0].id as string;
}

async function systemTagId(client: PoolClient, systemKey: string): Promise<string> {
  const { rows } = await client.query(`select id from public.time_tags where system_key = $1`, [systemKey]);
  return rows[0].id as string;
}

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

describe("time_entries invariants", () => {
  it("stores a closed manual entry with materialised duration", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "BASED");
      const me = await seedMember(client, { teamId });
      await asClaims(client, { sub: me.authUserId });

      const id = await insertClosedEntry(
        client,
        me.profileId,
        "2026-09-21T08:00:00Z",
        "2026-09-21T09:30:00Z",
        { title: "Prodávání párků před ČZU" },
      );
      const { rows } = await client.query(
        `select direction, duration_ms, source, title from public.time_entries where id = $1`,
        [id],
      );

      expect(rows[0].direction).toBe("practise");
      expect(Number(rows[0].duration_ms)).toBe(1.5 * HOUR_MS);
      expect(rows[0].source).toBe("manual");
      expect(rows[0].title).toBe("Prodávání párků před ČZU");
    });
  });

  it("allows only one running timer per person", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      await asClaims(client, { sub: me.authUserId });

      const running = `insert into public.time_entries
        (profile_id, direction, started_at, source, created_by_profile_id, updated_by_profile_id)
        values ($1, 'reading', $2::timestamptz, 'timer', $1, $1)`;

      await client.query(running, [me.profileId, "2026-09-21T08:00:00Z"]);
      // Savepoint so the failed statement does not poison the transaction.
      await client.query("savepoint second_timer");
      const code = await errorCode(client.query(running, [me.profileId, "2026-09-21T07:00:00Z"]));
      await client.query("rollback to savepoint second_timer");

      // The unique partial index and the exclusion constraint both guard this;
      // either code proves the DB refused the second running timer.
      expect([UNIQUE_VIOLATION, EXCLUSION_VIOLATION]).toContain(code);
    });
  });

  it("rejects overlapping closed entries of the same person, allows touching ones", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      await asClaims(client, { sub: me.authUserId });

      await insertClosedEntry(client, me.profileId, "2026-09-21T08:00:00Z", "2026-09-21T10:00:00Z");

      await client.query("savepoint overlap");
      const code = await errorCode(
        insertClosedEntry(client, me.profileId, "2026-09-21T09:00:00Z", "2026-09-21T11:00:00Z"),
      );
      await client.query("rollback to savepoint overlap");
      expect(code).toBe(EXCLUSION_VIOLATION);

      // [08:00,10:00) and [10:00,11:00) do not overlap.
      await expect(
        insertClosedEntry(client, me.profileId, "2026-09-21T10:00:00Z", "2026-09-21T11:00:00Z"),
      ).resolves.toBeTruthy();
    });
  });

  it("does not treat two people's entries as overlapping", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "PAVIAAN");
      const a = await seedMember(client, { teamId });
      const b = await seedMember(client, { teamId });

      await insertClosedEntry(client, a.profileId, "2026-09-21T08:00:00Z", "2026-09-21T10:00:00Z");
      await expect(
        insertClosedEntry(client, b.profileId, "2026-09-21T08:00:00Z", "2026-09-21T10:00:00Z"),
      ).resolves.toBeTruthy();
    });
  });

  it("rejects end before start but accepts very short entries", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);

      await client.query("savepoint bad_range");
      const rangeCode = await errorCode(
        insertClosedEntry(client, me.profileId, "2026-09-21T10:00:00Z", "2026-09-21T09:00:00Z"),
      );
      await client.query("rollback to savepoint bad_range");
      expect(rangeCode).toBe(CHECK_VIOLATION);

      // No minimum length: a 30 s entry is valid (product decision, 2026-09-24).
      await expect(
        insertClosedEntry(client, me.profileId, "2026-09-21T10:00:00Z", "2026-09-21T10:00:30Z"),
      ).resolves.toBeTruthy();
    });
  });

  it("allows an entry across midnight", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      const id = await insertClosedEntry(client, me.profileId, "2026-09-21T21:00:00Z", "2026-09-22T01:00:00Z");
      const { rows } = await client.query(`select duration_ms from public.time_entries where id = $1`, [id]);
      expect(Number(rows[0].duration_ms)).toBe(4 * HOUR_MS);
    });
  });

  it("nulls tag_id when the tag is deleted", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "BASED");
      const me = await seedMember(client, { teamId });
      const tagId = await insertTeamTag(client, teamId, me.profileId, "practise", "fellaship");
      const entryId = await insertClosedEntry(client, me.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z", { tagId });

      await client.query(`delete from public.time_tags where id = $1`, [tagId]);
      const { rows } = await client.query(`select tag_id from public.time_entries where id = $1`, [entryId]);
      expect(rows[0].tag_id).toBeNull();
    });
  });
});

describe("time_tags invariants", () => {
  it("seeds the fixed Training and Reading tags", async () => {
    await withRollback(async (client) => {
      const { rows } = await client.query(
        `select system_key, direction, name from public.time_tags where team_id is null order by system_key`,
      );
      expect(rows).toEqual([
        { system_key: "essay", direction: "reading", name: "Esej" },
        { system_key: "reading", direction: "reading", name: "Čtení" },
        { system_key: "training_session", direction: "training", name: "TS" },
        { system_key: "training_session_prep", direction: "training", name: "Příprava na TS" },
      ]);
    });
  });

  it("keeps tag names unique per team and direction, case- and whitespace-insensitively", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const teamB = await seedTeam(client, "TIMACE");
      const me = await seedMember(client, { teamId: teamA });
      const mate = await seedMember(client, { teamId: teamA });
      const other = await seedMember(client, { teamId: teamB });

      await insertTeamTag(client, teamA, me.profileId, "practise", "Fellaship");

      await client.query("savepoint dup");
      const code = await errorCode(insertTeamTag(client, teamA, mate.profileId, "practise", "  fellaship "));
      await client.query("rollback to savepoint dup");
      expect(code).toBe(UNIQUE_VIOLATION);

      // Same name is fine under another direction and in another team.
      await expect(insertTeamTag(client, teamA, me.profileId, "project", "fellaship")).resolves.toBeTruthy();
      await expect(insertTeamTag(client, teamB, other.profileId, "practise", "fellaship")).resolves.toBeTruthy();
    });
  });

  it("requires a direction", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "BASED");
      const code = await errorCode(
        client.query(`insert into public.time_tags (team_id, name) values ($1, 'fellaship')`, [teamId]),
      );
      expect(code).toBe("23502");
    });
  });

  it("allows team tags only for Practise / Projekt and system tags only for Training / Reading", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "BASED");
      const me = await seedMember(client, { teamId });

      await client.query("savepoint team_reading");
      const teamReading = await errorCode(insertTeamTag(client, teamId, me.profileId, "reading", "Kniha"));
      await client.query("rollback to savepoint team_reading");
      expect(teamReading).toBe(CHECK_VIOLATION);

      await client.query("savepoint system_practise");
      const systemPractise = await errorCode(
        client.query(`insert into public.time_tags (system_key, direction, name) values ('x', 'practise', 'X')`),
      );
      await client.query("rollback to savepoint system_practise");
      expect(systemPractise).toBe(CHECK_VIOLATION);

      const teamWithoutKey = await errorCode(
        client.query(`insert into public.time_tags (direction, name) values ('reading', 'Kniha')`),
      );
      expect(teamWithoutKey).toBe(CHECK_VIOLATION);
    });
  });

  it("accepts the project direction for tags and entries", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "BASED");
      const me = await seedMember(client, { teamId });
      const tagId = await insertTeamTag(client, teamId, me.profileId, "project", "Tappka");
      const entryId = await insertClosedEntry(client, me.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z", {
        direction: "project",
        tagId,
      });
      expect(entryId).toBeTruthy();
    });
  });

  it("lets an entry use only a tag of its own direction", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "BASED");
      const me = await seedMember(client, { teamId });
      const readingTag = await systemTagId(client, "reading");

      await client.query("savepoint mismatch");
      const insertCode = await errorCode(
        insertClosedEntry(client, me.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z", {
          direction: "practise",
          tagId: readingTag,
        }),
      );
      await client.query("rollback to savepoint mismatch");
      expect(insertCode).toBe(FOREIGN_KEY_VIOLATION);

      const entryId = await insertClosedEntry(client, me.profileId, "2026-09-21T10:00:00Z", "2026-09-21T11:00:00Z", {
        direction: "reading",
        tagId: readingTag,
      });

      // Moving the entry to another direction while keeping the tag is rejected ...
      await client.query("savepoint move");
      const updateCode = await errorCode(
        client.query(`update public.time_entries set direction = 'practise' where id = $1`, [entryId]),
      );
      await client.query("rollback to savepoint move");
      expect(updateCode).toBe(FOREIGN_KEY_VIOLATION);

      // ... and so is moving a used team tag to another direction.
      const practiseTag = await insertTeamTag(client, teamId, me.profileId, "practise", "fellaship");
      await insertClosedEntry(client, me.profileId, "2026-09-21T12:00:00Z", "2026-09-21T13:00:00Z", {
        direction: "practise",
        tagId: practiseTag,
      });
      await client.query("savepoint retag");
      const tagCode = await errorCode(
        client.query(`update public.time_tags set direction = 'project' where id = $1`, [practiseTag]),
      );
      await client.query("rollback to savepoint retag");
      expect(tagCode).toBe(FOREIGN_KEY_VIOLATION);

      // Changing direction together with dropping the tag is fine.
      await expect(
        client.query(`update public.time_entries set direction = 'practise', tag_id = null where id = $1`, [entryId]),
      ).resolves.toBeTruthy();
    });
  });
});

describe("time_entries RLS", () => {
  it("owner reads and edits own entries; teammate reads but cannot edit; other team sees nothing", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const teamB = await seedTeam(client, "TIMACE");
      const owner = await seedMember(client, { teamId: teamA });
      const teammate = await seedMember(client, { teamId: teamA });
      const stranger = await seedMember(client, { teamId: teamB });

      const entryId = await insertClosedEntry(client, owner.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");

      // Owner
      await client.query("savepoint owner");
      await asClaims(client, { sub: owner.authUserId });
      const { rowCount: ownerSees } = await client.query(`select id from public.time_entries where id = $1`, [entryId]);
      const { rowCount: ownerUpdates } = await client.query(
        `update public.time_entries set title = 'upraveno', updated_by_profile_id = $2 where id = $1`,
        [entryId, owner.profileId],
      );
      await client.query("rollback to savepoint owner");
      expect(ownerSees).toBe(1);
      expect(ownerUpdates).toBe(1);

      // Teammate
      await client.query("savepoint teammate");
      await asClaims(client, { sub: teammate.authUserId });
      const { rowCount: mateSees } = await client.query(`select id from public.time_entries where id = $1`, [entryId]);
      const { rowCount: mateUpdates } = await client.query(
        `update public.time_entries set title = 'cizí' where id = $1`,
        [entryId],
      );
      const { rowCount: mateDeletes } = await client.query(`delete from public.time_entries where id = $1`, [entryId]);
      await client.query("rollback to savepoint teammate");
      expect(mateSees).toBe(1);
      expect(mateUpdates).toBe(0);
      expect(mateDeletes).toBe(0);

      // Stranger
      await client.query("savepoint stranger");
      await asClaims(client, { sub: stranger.authUserId });
      const { rowCount: strangerSees } = await client.query(`select id from public.time_entries where id = $1`, [entryId]);
      await client.query("rollback to savepoint stranger");
      expect(strangerSees).toBe(0);
    });
  });

  it("coaches and admins read everything, even without a team", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const owner = await seedMember(client, { teamId: teamA });
      const coach = await seedMember(client, { role: "coach" });
      const admin = await seedMember(client, { role: "admin" });
      const entryId = await insertClosedEntry(client, owner.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");

      for (const staff of [coach, admin]) {
        await client.query("savepoint staff");
        await asClaims(client, { sub: staff.authUserId });
        const { rowCount } = await client.query(`select id from public.time_entries where id = $1`, [entryId]);
        const { rowCount: updates } = await client.query(`update public.time_entries set title = 'x' where id = $1`, [entryId]);
        await client.query("rollback to savepoint staff");
        expect(rowCount).toBe(1);
        expect(updates).toBe(0);
      }
    });
  });

  it("refuses inserting for someone else or with source = attendance", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const me = await seedMember(client, { teamId: teamA });
      const mate = await seedMember(client, { teamId: teamA });
      await asClaims(client, { sub: me.authUserId });

      await client.query("savepoint for_other");
      const otherCode = await errorCode(
        insertClosedEntry(client, mate.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z"),
      );
      await client.query("rollback to savepoint for_other");
      expect(otherCode).toBe(INSUFFICIENT_PRIVILEGE);

      await client.query("savepoint as_attendance");
      const attendanceCode = await errorCode(
        client.query(
          `insert into public.time_entries
             (profile_id, direction, started_at, ended_at, duration_ms, source, created_by_profile_id, updated_by_profile_id)
           values ($1, 'training', '2026-09-21T08:00:00Z', '2026-09-21T09:00:00Z', 3600000, 'attendance', $1, $1)`,
          [me.profileId],
        ),
      );
      await client.query("rollback to savepoint as_attendance");
      expect(attendanceCode).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });

  it("team tags: the team reads them, only the creator edits, other teams see nothing", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const teamB = await seedTeam(client, "TIMACE");
      const me = await seedMember(client, { teamId: teamA });
      const mate = await seedMember(client, { teamId: teamA });
      const stranger = await seedMember(client, { teamId: teamB });
      const tagId = await insertTeamTag(client, teamA, me.profileId, "practise", "fellaship");

      await client.query("savepoint as_mate");
      await asClaims(client, { sub: mate.authUserId });
      const { rowCount: mateSees } = await client.query(`select id from public.time_tags where id = $1`, [tagId]);
      const { rowCount: mateEdits } = await client.query(`update public.time_tags set name = 'x' where id = $1`, [tagId]);
      const { rowCount: mateDeletes } = await client.query(`delete from public.time_tags where id = $1`, [tagId]);
      await client.query("rollback to savepoint as_mate");
      expect(mateSees).toBe(1);
      expect(mateEdits).toBe(0);
      expect(mateDeletes).toBe(0);

      await client.query("savepoint as_stranger");
      await asClaims(client, { sub: stranger.authUserId });
      const { rowCount: strangerSees } = await client.query(`select id from public.time_tags where id = $1`, [tagId]);
      await client.query("rollback to savepoint as_stranger");
      expect(strangerSees).toBe(0);

      await asClaims(client, { sub: me.authUserId });
      const { rowCount: ownerEdits } = await client.query(`update public.time_tags set name = 'Fellaship' where id = $1`, [tagId]);
      expect(ownerEdits).toBe(1);
    });
  });

  it("members create tags only for their own team", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const teamB = await seedTeam(client, "TIMACE");
      const me = await seedMember(client, { teamId: teamA });

      await asClaims(client, { sub: me.authUserId });
      await expect(insertTeamTag(client, teamA, me.profileId, "project", "Tappka")).resolves.toBeTruthy();

      await client.query("savepoint foreign_team");
      const code = await errorCode(insertTeamTag(client, teamB, me.profileId, "project", "Tappka"));
      await client.query("rollback to savepoint foreign_team");
      expect(code).toBe(INSUFFICIENT_PRIVILEGE);
    });
  });

  it("everyone reads system tags, nobody changes them", async () => {
    await withRollback(async (client) => {
      const coach = await seedMember(client, { role: "coach" });
      const student = await seedMember(client);
      const tsTag = await systemTagId(client, "training_session");

      await client.query("savepoint as_student");
      await asClaims(client, { sub: student.authUserId });
      const { rowCount: sees } = await client.query(`select id from public.time_tags where id = $1`, [tsTag]);
      await client.query("rollback to savepoint as_student");
      expect(sees).toBe(1);

      await asClaims(client, { sub: coach.authUserId });
      const { rowCount: edits } = await client.query(`update public.time_tags set name = 'x' where id = $1`, [tsTag]);
      const { rowCount: deletes } = await client.query(`delete from public.time_tags where id = $1`, [tsTag]);
      expect(edits).toBe(0);
      expect(deletes).toBe(0);
    });
  });

  it("coaches can rename and delete any team tag", async () => {
    await withRollback(async (client) => {
      const teamId = await seedTeam(client, "BASED");
      const me = await seedMember(client, { teamId });
      const coach = await seedMember(client, { role: "coach" });
      const tagId = await insertTeamTag(client, teamId, me.profileId, "practise", "fellaship");

      await asClaims(client, { sub: coach.authUserId });
      const { rowCount: edits } = await client.query(`update public.time_tags set name = 'Fella' where id = $1`, [tagId]);
      const { rowCount: deletes } = await client.query(`delete from public.time_tags where id = $1`, [tagId]);
      expect(edits).toBe(1);
      expect(deletes).toBe(1);
    });
  });
});

describe("time_tag_selections and time_tracking_preferences RLS", () => {
  it("each person shows only own team tags and sees only own selections", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const teamB = await seedTeam(client, "TIMACE");
      const me = await seedMember(client, { teamId: teamA });
      const mate = await seedMember(client, { teamId: teamA });
      const stranger = await seedMember(client, { teamId: teamB });
      const ownTag = await insertTeamTag(client, teamA, mate.profileId, "practise", "fellaship");
      const foreignTag = await insertTeamTag(client, teamB, stranger.profileId, "practise", "kavárna");
      await client.query(`insert into public.time_tag_selections (profile_id, tag_id) values ($1, $2)`, [
        mate.profileId,
        ownTag,
      ]);

      await asClaims(client, { sub: me.authUserId });
      await expect(
        client.query(`insert into public.time_tag_selections (profile_id, tag_id) values ($1, $2)`, [me.profileId, ownTag]),
      ).resolves.toBeTruthy();

      await client.query("savepoint foreign_tag");
      const foreignCode = await errorCode(
        client.query(`insert into public.time_tag_selections (profile_id, tag_id) values ($1, $2)`, [me.profileId, foreignTag]),
      );
      await client.query("rollback to savepoint foreign_tag");
      expect(foreignCode).toBe(INSUFFICIENT_PRIVILEGE);

      await client.query("savepoint for_mate");
      const forMateCode = await errorCode(
        client.query(`insert into public.time_tag_selections (profile_id, tag_id) values ($1, $2)`, [mate.profileId, ownTag]),
      );
      await client.query("rollback to savepoint for_mate");
      expect(forMateCode).toBe(INSUFFICIENT_PRIVILEGE);

      const { rows } = await client.query(`select profile_id from public.time_tag_selections`);
      expect(rows).toEqual([{ profile_id: me.profileId }]);
    });
  });

  it("time tracking preferences are private", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      const other = await seedMember(client);
      await client.query(`insert into public.time_tracking_preferences (profile_id, tags_reviewed_at) values ($1, now())`, [
        other.profileId,
      ]);

      await asClaims(client, { sub: me.authUserId });
      await expect(
        client.query(`insert into public.time_tracking_preferences (profile_id, tags_reviewed_at) values ($1, now())`, [
          me.profileId,
        ]),
      ).resolves.toBeTruthy();
      const { rows } = await client.query(`select profile_id from public.time_tracking_preferences`);
      expect(rows).toEqual([{ profile_id: me.profileId }]);
    });
  });
});
