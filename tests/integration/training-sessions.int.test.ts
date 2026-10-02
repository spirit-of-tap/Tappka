import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

interface Seeded {
  teamId: string;
  otherTeamId: string;
  owner: { profileId: string; authId: string };
  teammate: { profileId: string; authId: string };
  other: { profileId: string; authId: string };
  outsider: { profileId: string; authId: string };
  coach: { profileId: string; authId: string };
}

async function insertMember(
  client: PoolClient,
  name: string,
  teamId: string | null,
  role: "student" | "coach" = "student",
) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where auth_user_id = $1 returning id",
    [auth.id],
  );
  const { rows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ($1, $2, $3, $4, $5) returning id`,
    [name, `ts-${name.toLowerCase()}-${auth.id.slice(0, 8)}@studenti.czu.cz`, userRows[0].id, teamId, role],
  );
  return { profileId: rows[0].id as string, authId: auth.id };
}

async function seed(client: PoolClient): Promise<Seeded> {
  const { rows } = await client.query(
    "insert into public.teams (name) values ('TS Team A'), ('TS Team B') returning id",
  );
  const teamId = rows[0].id as string;
  const otherTeamId = rows[1].id as string;
  return {
    teamId,
    otherTeamId,
    owner: await insertMember(client, "Owner", teamId),
    teammate: await insertMember(client, "Teammate", teamId),
    other: await insertMember(client, "Other", otherTeamId),
    outsider: await insertMember(client, "Outsider", otherTeamId),
    coach: await insertMember(client, "Coach", null, "coach"),
  };
}

async function insertSession(
  client: PoolClient,
  teamId: string,
  profileId: string,
  opts: { capacity?: number; startsInHours?: number } = {},
): Promise<string> {
  const startsIn = opts.startsInHours ?? 24;
  const { rows } = await client.query(
    `insert into public.training_sessions
       (team_id, topic, starts_at, ends_at, guest_capacity, created_by_profile_id, updated_by_profile_id)
     values ($1, 'AI v projektech', now() + make_interval(hours => $2), now() + make_interval(hours => $2 + 4), $3, $4, $4)
     returning id`,
    [teamId, startsIn, opts.capacity ?? 2, profileId],
  );
  return rows[0].id as string;
}

describe("training_sessions RLS", () => {
  it("lets any authenticated user read a session, but only the team insert one", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);

      await asClaims(client, { sub: s.other.authId });
      const { rows } = await client.query("select id from public.training_sessions where id = $1", [id]);
      expect(rows).toHaveLength(1);

      await expect(insertSession(client, s.teamId, s.other.profileId)).rejects.toThrow(/row-level security/);
    });
  });

  it("does not let another team update a session", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);

      await asClaims(client, { sub: s.other.authId });
      const res = await client.query("update public.training_sessions set topic = 'x' where id = $1", [id]);
      expect(res.rowCount).toBe(0);
    });
  });

  it("hides draft preparation from other teams and shows it once published", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query(
        `insert into public.training_session_preparations
           (training_session_id, content_json, content_text, created_by_profile_id, updated_by_profile_id)
         values ($1, '{"type":"doc"}', 'Přečtěte si článek', $2, $2)`,
        [id, s.owner.profileId],
      );

      await asClaims(client, { sub: s.teammate.authId });
      expect((await client.query("select 1 from public.training_session_preparations where training_session_id = $1", [id])).rows).toHaveLength(1);

      await asClaims(client, { sub: s.other.authId });
      expect((await client.query("select 1 from public.training_session_preparations where training_session_id = $1", [id])).rows).toHaveLength(0);

      await asClaims(client, { sub: s.owner.authId });
      await client.query("update public.training_session_preparations set published_at = now() where training_session_id = $1", [id]);

      await asClaims(client, { sub: s.other.authId });
      expect((await client.query("select 1 from public.training_session_preparations where training_session_id = $1", [id])).rows).toHaveLength(1);
    });
  });

  it("keeps reflection and attendance team-only, including from coaches", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query(
        `insert into public.training_session_reflections
           (training_session_id, content_json, content_text, created_by_profile_id, updated_by_profile_id)
         values ($1, '{"type":"doc"}', 'Šlo to dobře', $2, $2)`,
        [id, s.owner.profileId],
      );
      await client.query(
        `insert into public.training_session_attendees
           (training_session_id, profile_id, status, created_by_profile_id, updated_by_profile_id)
         values ($1, $2, 'present', $2, $2)`,
        [id, s.teammate.profileId],
      );

      for (const viewer of [s.other, s.coach]) {
        await asClaims(client, { sub: viewer.authId });
        expect((await client.query("select 1 from public.training_session_reflections where training_session_id = $1", [id])).rows).toHaveLength(0);
        expect((await client.query("select 1 from public.training_session_attendees where training_session_id = $1", [id])).rows).toHaveLength(0);
      }
    });
  });

  it("rejects a facilitator from another team", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await expect(
        client.query(
          "insert into public.training_session_facilitators (training_session_id, profile_id, created_by_profile_id) values ($1, $2, $3)",
          [id, s.other.profileId, s.owner.profileId],
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("does not allow direct inserts into guests", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await asClaims(client, { sub: s.other.authId });
      await expect(
        client.query("insert into public.training_session_guests (training_session_id, profile_id) values ($1, $2)", [id, s.other.profileId]),
      ).rejects.toThrow(/row-level security/);
    });
  });
});

// Each call runs in a savepoint so an expected rejection doesn't abort the
// surrounding withRollback() transaction for later asserts.
async function join(client: PoolClient, sessionId: string): Promise<number> {
  await client.query("savepoint join_training_session");
  try {
    const { rows } = await client.query("select public.join_training_session($1) as n", [sessionId]);
    await client.query("release savepoint join_training_session");
    return rows[0].n as number;
  } catch (error) {
    await client.query("rollback to savepoint join_training_session");
    throw error;
  }
}

describe("join_training_session / leave_training_session", () => {
  it("lets a member of another team join and returns the guest count", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId, { capacity: 2 });
      await asClaims(client, { sub: s.other.authId });
      expect(await join(client, id)).toBe(1);
      expect(await join(client, id)).toBe(1); // idempotent
    });
  });

  it("enforces capacity", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId, { capacity: 1 });
      await asClaims(client, { sub: s.other.authId });
      await join(client, id);
      await asClaims(client, { sub: s.outsider.authId });
      await expect(join(client, id)).rejects.toThrow("capacity_full");
    });
  });

  it("rejects own team, started and cancelled sessions", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const future = await insertSession(client, s.teamId, s.owner.profileId);
      const started = await insertSession(client, s.teamId, s.owner.profileId, { startsInHours: -1 });
      const cancelled = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query("update public.training_sessions set cancelled_at = now() where id = $1", [cancelled]);

      await asClaims(client, { sub: s.teammate.authId });
      await expect(join(client, future)).rejects.toThrow("own_team");

      await asClaims(client, { sub: s.other.authId });
      await expect(join(client, started)).rejects.toThrow("already_started");
      await expect(join(client, cancelled)).rejects.toThrow("cancelled");
    });
  });

  it("lets a coach without a team join and leave", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await asClaims(client, { sub: s.coach.authId });
      expect(await join(client, id)).toBe(1);
      const { rows } = await client.query("select public.leave_training_session($1) as n", [id]);
      expect(rows[0].n).toBe(0);
    });
  });

  it("returns ids from search only for published preparation", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query(
        `insert into public.training_session_preparations
           (training_session_id, content_json, content_text, created_by_profile_id, updated_by_profile_id)
         values ($1, '{"type":"doc"}', 'vyjednávání se zákazníkem', $2, $2)`,
        [id, s.owner.profileId],
      );
      await asClaims(client, { sub: s.other.authId });
      const search = async (q: string) =>
        (await client.query("select * from public.search_training_sessions($1) as id", [q])).rows.map((r) => r.id);
      expect(await search("vyjednávání")).toEqual([]);
      expect(await search("AI v")).toEqual([id]); // topic match

      await asClaims(client, { sub: s.owner.authId });
      await client.query("update public.training_session_preparations set published_at = now() where training_session_id = $1", [id]);
      await asClaims(client, { sub: s.other.authId });
      expect(await search("vyjednávání")).toEqual([id]);
      expect(await search("100%")).toEqual([]); // wildcard escaped
    });
  });
});

describe("remove_training_session", () => {
  it("lets the owning team remove a session, hiding it from others", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await client.query("select public.remove_training_session($1)", [id]);

      await asClaims(client, { sub: s.other.authId });
      const { rows } = await client.query("select id from public.training_sessions where id = $1", [id]);
      expect(rows).toHaveLength(0);
    });
  });

  it("rejects removal by a member of another team", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.owner.authId });
      const id = await insertSession(client, s.teamId, s.owner.profileId);
      await asClaims(client, { sub: s.other.authId });
      await expect(client.query("select public.remove_training_session($1)", [id])).rejects.toThrow("forbidden");
    });
  });
});

export { seed, insertSession };
