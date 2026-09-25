import { describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { withRollback } from "@/tests/setup/tx";
import { insertAuthUser } from "@/tests/setup/factories";

// Monday 2026-09-21 in Europe/Prague is CEST (UTC+2): 08:00–12:00 local = 06:00–10:00Z.
const TS_DATE = "2026-09-21";
const TS_DAY_OF_WEEK = 1; // JS getDay(): Monday
const EXPECTED_START = "2026-09-21T06:00:00.000Z";
const EXPECTED_END = "2026-09-21T10:00:00.000Z";
const FOUR_HOURS_MS = 4 * 3_600_000;

interface Fixture {
  teamId: string;
  managerId: string;
  memberId: string;
  activityId: string;
}

async function seedTeamWithTs(client: PoolClient, opts: { withSchedule?: boolean } = {}): Promise<Fixture> {
  const { rows: teamRows } = await client.query(`insert into public.teams (name) values ('BASED') returning id`);
  const teamId = teamRows[0].id as string;

  // profiles has an update trigger that blocks changing team_id later, so insert complete rows.
  const seedMember = async (name: string) => {
    const auth = await insertAuthUser(client);
    const { rows: userRows } = await client.query(
      `update public.users set verified_work_email = google_email, verified_work_email_at = now()
       where auth_user_id = $1 returning id`,
      [auth.id],
    );
    const { rows } = await client.query(
      `insert into public.profiles (name, work_email, user_id, role, team_id, beta_access_granted_at)
       values ($1, $2, $3, 'student', $4, now()) returning id`,
      [name, `tt-${auth.id}@studenti.czu.cz`, userRows[0].id, teamId],
    );
    return { profileId: rows[0].id as string };
  };
  const manager = await seedMember("Manažer:ka");
  const member = await seedMember("Člen:ka");

  if (opts.withSchedule ?? true) {
    const { rows: roomRows } = await client.query(
      `insert into public.rooms (code, name, created_by_profile_id, updated_by_profile_id)
       values ('T1', 'Týmovka', $1, $1) returning id`,
      [manager.profileId],
    );
    await client.query(
      `insert into public.recurring_schedules
         (room_id, team_id, schedule_type, day_of_week, start_time, end_time, valid_from, valid_until,
          created_by_profile_id, updated_by_profile_id)
       values ($1, $2, 'training_session', $3, '08:00', '12:00', '2026-09-01', '2026-12-31', $4, $4)`,
      [roomRows[0].id, teamId, TS_DAY_OF_WEEK, manager.profileId],
    );
  }

  const { rows: activityRows } = await client.query(
    `insert into public.team_activities
       (team_id, occurred_at, activity_type, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, 'training_session', $3, $3) returning id`,
    [teamId, TS_DATE, manager.profileId],
  );

  return { teamId, managerId: manager.profileId, memberId: member.profileId, activityId: activityRows[0].id as string };
}

async function markAttendance(client: PoolClient, f: Fixture, status: string): Promise<string> {
  const { rows } = await client.query(
    `insert into public.team_activity_attendees
       (activity_id, profile_id, status, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $4)
     on conflict (activity_id, profile_id) do update set status = excluded.status
     returning id`,
    [f.activityId, f.memberId, status, f.managerId],
  );
  return rows[0].id as string;
}

async function autoEntries(client: PoolClient, profileId: string) {
  const { rows } = await client.query(
    `select id, direction, title, source, attendance_id, started_at, ended_at, duration_ms
       from public.time_entries where profile_id = $1 order by started_at`,
    [profileId],
  );
  return rows as Array<{
    id: string;
    direction: string;
    title: string | null;
    source: string;
    attendance_id: string | null;
    started_at: Date;
    ended_at: Date | null;
    duration_ms: string | null;
  }>;
}

describe("sync_training_session_time_entry", () => {
  it("creates a 4 h training entry when a member is marked present", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      const attendanceId = await markAttendance(client, f, "present");

      const entries = await autoEntries(client, f.memberId);
      expect(entries).toHaveLength(1);
      expect(entries[0].direction).toBe("training");
      expect(entries[0].title).toBe("Training Session");
      expect(entries[0].source).toBe("attendance");
      expect(entries[0].attendance_id).toBe(attendanceId);
      expect(entries[0].started_at.toISOString()).toBe(EXPECTED_START);
      expect(entries[0].ended_at?.toISOString()).toBe(EXPECTED_END);
      expect(Number(entries[0].duration_ms)).toBe(FOUR_HOURS_MS);
    });
  });

  it("is idempotent when present is written twice", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await markAttendance(client, f, "present");
      await markAttendance(client, f, "present");
      await client.query(`update public.team_activity_attendees set status = 'present' where activity_id = $1`, [f.activityId]);

      expect(await autoEntries(client, f.memberId)).toHaveLength(1);
    });
  });

  it("leaves a tracked entry in the TS window untouched (rule 1)", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await client.query(
        `insert into public.time_entries
           (profile_id, direction, title, started_at, ended_at, duration_ms, source,
            created_by_profile_id, updated_by_profile_id)
         values ($1, 'practise', 'Prodej párků', '2026-09-21T07:00:00Z', '2026-09-21T08:00:00Z', 3600000, 'manual', $1, $1)`,
        [f.memberId],
      );

      await markAttendance(client, f, "present");

      const entries = await autoEntries(client, f.memberId);
      expect(entries).toHaveLength(1);
      expect(entries[0].source).toBe("manual");
      expect(entries[0].title).toBe("Prodej párků");
    });
  });

  it("removes the untouched auto entry when status changes away from present (rule 3)", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(1);

      await markAttendance(client, f, "absent");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });

  it("keeps an auto entry the member has edited", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await markAttendance(client, f, "present");
      const [entry] = await autoEntries(client, f.memberId);

      // The app always stamps updated_by_profile_id on edits; the trigger uses that as "touched".
      await client.query(
        `update public.time_entries
           set ended_at = '2026-09-21T09:00:00Z', duration_ms = 10800000, updated_by_profile_id = $2
         where id = $1`,
        [entry.id, f.managerId],
      );

      await markAttendance(client, f, "excused");
      const remaining = await autoEntries(client, f.memberId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(entry.id);
    });
  });

  it("creates nothing when the team has no TS schedule for that weekday (rule 4)", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client, { withSchedule: false });
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });

  it("ignores activities that are not training sessions", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await client.query(`update public.team_activities set activity_type = 'Cabin in the Woods' where id = $1`, [f.activityId]);
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });

  it("cascades the auto entry away when the attendance row is deleted", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      const attendanceId = await markAttendance(client, f, "present");
      await client.query(`delete from public.team_activity_attendees where id = $1`, [attendanceId]);
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });
});
