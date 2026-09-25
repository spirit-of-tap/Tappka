import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";

// Postgres SQLSTATE codes surfaced by `pg` as `error.code`.
const UNIQUE_VIOLATION = "23505";
const EXCLUSION_VIOLATION = "23P01";
const CHECK_VIOLATION = "23514";
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
      const me = await seedMember(client);
      const { rows: tagRows } = await client.query(
        `insert into public.time_tags (profile_id, name, created_by_profile_id, updated_by_profile_id)
         values ($1, 'fellaship', $1, $1) returning id`,
        [me.profileId],
      );
      const tagId = tagRows[0].id as string;
      const entryId = await insertClosedEntry(client, me.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z", { tagId });

      await client.query(`delete from public.time_tags where id = $1`, [tagId]);
      const { rows } = await client.query(`select tag_id from public.time_entries where id = $1`, [entryId]);
      expect(rows[0].tag_id).toBeNull();
    });
  });
});

describe("time_tags invariants", () => {
  it("keeps tag names unique per person, case- and whitespace-insensitively", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      const other = await seedMember(client);
      const insert = `insert into public.time_tags (profile_id, name, created_by_profile_id, updated_by_profile_id)
                      values ($1, $2, $1, $1)`;

      await client.query(insert, [me.profileId, "Fellaship"]);

      await client.query("savepoint dup");
      const code = await errorCode(client.query(insert, [me.profileId, "  fellaship "]));
      await client.query("rollback to savepoint dup");
      expect(code).toBe(UNIQUE_VIOLATION);

      // Same name is fine for a different person.
      await expect(client.query(insert, [other.profileId, "fellaship"])).resolves.toBeTruthy();
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

  it("teammates can read each other's tags but not edit them", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const me = await seedMember(client, { teamId: teamA });
      const mate = await seedMember(client, { teamId: teamA });
      const { rows } = await client.query(
        `insert into public.time_tags (profile_id, name, created_by_profile_id, updated_by_profile_id)
         values ($1, 'fellaship', $1, $1) returning id`,
        [me.profileId],
      );
      const tagId = rows[0].id as string;

      await asClaims(client, { sub: mate.authUserId });
      const { rowCount: sees } = await client.query(`select id from public.time_tags where id = $1`, [tagId]);
      const { rowCount: edits } = await client.query(`update public.time_tags set name = 'x' where id = $1`, [tagId]);
      expect(sees).toBe(1);
      expect(edits).toBe(0);
    });
  });
});
