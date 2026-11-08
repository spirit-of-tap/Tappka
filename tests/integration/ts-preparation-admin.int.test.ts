import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";

import { insertAuthUser } from "@/tests/setup/factories";
import { asClaims } from "@/tests/setup/rls";
import { withRollback } from "@/tests/setup/tx";

type Role = "student" | "coach" | "admin";

async function insertPerson(client: PoolClient, name: string, teamId: string | null, role: Role) {
  const auth = await insertAuthUser(client);
  const { rows: userRows } = await client.query(
    "update public.users set verified_work_email = google_email, verified_work_email_at = now() where auth_user_id = $1 returning id",
    [auth.id],
  );
  const { rows } = await client.query(
    `insert into public.profiles (name, work_email, user_id, team_id, role)
     values ($1, $2, $3, $4, $5) returning id`,
    [name, `prep-${name.toLowerCase()}-${auth.id.slice(0, 8)}@studenti.czu.cz`, userRows[0].id, teamId, role],
  );
  return { profileId: rows[0].id as string, authId: auth.id };
}

async function seed(client: PoolClient) {
  const { rows } = await client.query("insert into public.teams (name) values ('Prep A'), ('Prep B') returning id");
  const teamId = rows[0].id as string;
  const facilitator = await insertPerson(client, "Facilitator", teamId, "student");
  const { rows: sessionRows } = await client.query(
    `insert into public.training_sessions (team_id, topic, starts_at, ends_at, created_by_profile_id, updated_by_profile_id)
     values ($1, 'Vyjednávání', now() + interval '1 day', now() + interval '1 day 3 hours', $2, $2) returning id`,
    [teamId, facilitator.profileId],
  );
  const sessionId = sessionRows[0].id as string;
  await client.query(
    "insert into public.training_session_facilitators (training_session_id, profile_id, created_by_profile_id) values ($1, $2, $2)",
    [sessionId, facilitator.profileId],
  );
  // An unpublished draft: only the team (and now admins) may see it.
  await client.query(
    `insert into public.training_session_preparations
       (training_session_id, content_json, content_text, published_at, created_by_profile_id, updated_by_profile_id)
     values ($1, '{}'::jsonb, 'koncept', null, $2, $2)`,
    [sessionId, facilitator.profileId],
  );
  return {
    sessionId,
    admin: await insertPerson(client, "Admin", rows[1].id as string, "admin"),
    coach: await insertPerson(client, "Coach", null, "coach"),
    outsider: await insertPerson(client, "Outsider", rows[1].id as string, "student"),
  };
}

const updatePrep = (client: PoolClient, sessionId: string, profileId: string) =>
  client.query(
    "update public.training_session_preparations set content_text = 'opraveno', updated_by_profile_id = $2 where training_session_id = $1",
    [sessionId, profileId],
  );

const insertAttachment = (client: PoolClient, sessionId: string, profileId: string) =>
  client.query(
    `insert into public.training_session_attachments
       (training_session_id, label, file_path, file_name, file_size, content_type, created_by_profile_id)
     values ($1, 'Pracovní list', $2, 'list.pdf', 1024, 'application/pdf', $3) returning id`,
    [sessionId, `ts/${sessionId}/${profileId}.pdf`, profileId],
  );

describe("TS preparation: admin override", () => {
  it("lets an admin of another team see and edit a draft preparation", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.admin.authId });
      const { rows } = await client.query(
        "select content_text from public.training_session_preparations where training_session_id = $1",
        [s.sessionId],
      );
      expect(rows).toEqual([{ content_text: "koncept" }]);
      expect((await updatePrep(client, s.sessionId, s.admin.profileId)).rowCount).toBe(1);
    });
  });

  it("lets an admin add and remove attachments on any session", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.admin.authId });
      const { rows } = await insertAttachment(client, s.sessionId, s.admin.profileId);
      const { rowCount } = await client.query("delete from public.training_session_attachments where id = $1", [rows[0].id]);
      expect(rowCount).toBe(1);
    });
  });

  it("still keeps coaches and other teams out of someone else's preparation", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      for (const person of [s.coach, s.outsider]) {
        await asClaims(client, { sub: person.authId });
        expect((await updatePrep(client, s.sessionId, person.profileId)).rowCount).toBe(0);
      }
    });
  });

  it("still blocks a coach from adding attachments", async () => {
    await withRollback(async (client) => {
      const s = await seed(client);
      await asClaims(client, { sub: s.coach.authId });
      await expect(insertAttachment(client, s.sessionId, s.coach.profileId)).rejects.toThrow(/row-level security/);
    });
  });
});
