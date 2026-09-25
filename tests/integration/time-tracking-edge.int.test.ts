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
  const { rows } = await client.query(`insert into public.teams (name) values ($1) returning id`, [name]);
  return rows[0].id as string;
}

// profiles has an update trigger (validate_picture_only_update) that blocks changing
// role/team_id/access_removed_at etc. once the acting role is `authenticated`. As long as
// we run these updates before calling asClaims() (still on the pool's postgres role), or via
// `service_role`, the trigger bypasses the restriction (see 20260922044522_neat_shotgun.sql).
async function seedMember(
  client: PoolClient,
  opts: { teamId?: string | null; role?: "student" | "mentor" | "coach" | "admin" } = {},
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

async function insertRunningTimer(client: PoolClient, profileId: string, startedAt: string): Promise<string> {
  const { rows } = await client.query(
    `insert into public.time_entries (profile_id, direction, started_at, source, created_by_profile_id, updated_by_profile_id)
     values ($1, 'reading', $2::timestamptz, 'timer', $1, $1) returning id`,
    [profileId, startedAt],
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

// ---------------------------------------------------------------------------
// sync_training_session_time_entry — edge cases
// ---------------------------------------------------------------------------

interface Fixture {
  teamId: string;
  managerId: string;
  memberId: string;
  activityId: string;
}

interface ScheduleOpts {
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
  validFrom?: string;
  validUntil?: string | null;
  removedAt?: string | null;
}

async function insertSchedule(client: PoolClient, teamId: string, ownerId: string, roomId: string, opts: ScheduleOpts) {
  const { rows } = await client.query(
    `insert into public.recurring_schedules
       (room_id, team_id, schedule_type, day_of_week, start_time, end_time, valid_from, valid_until,
        created_by_profile_id, updated_by_profile_id)
     values ($1, $2, 'training_session', $3, $4, $5, $6, $7, $8, $8) returning id`,
    [
      roomId,
      teamId,
      opts.dayOfWeek,
      opts.startTime ?? "08:00",
      opts.endTime ?? "12:00",
      opts.validFrom ?? "2026-01-01",
      opts.validUntil === undefined ? "2026-12-31" : opts.validUntil,
      ownerId,
    ],
  );
  if (opts.removedAt) {
    await client.query(`update public.recurring_schedules set removed_at = $2 where id = $1`, [rows[0].id, opts.removedAt]);
  }
  return rows[0].id as string;
}

async function seedTeamWithTs(
  client: PoolClient,
  opts: {
    date?: string;
    activityType?: string;
    schedules?: ScheduleOpts[];
  } = {},
): Promise<Fixture & { roomId: string }> {
  const date = opts.date ?? "2026-09-21";
  const { rows: teamRows } = await client.query(`insert into public.teams (name) values ('BASED') returning id`);
  const teamId = teamRows[0].id as string;

  const seedTeamMember = async (name: string) => {
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
    return { profileId: rows[0].id as string, authUserId: auth.id as string };
  };
  const manager = await seedTeamMember("Manažer:ka");
  const member = await seedTeamMember("Člen:ka");

  const { rows: roomRows } = await client.query(
    `insert into public.rooms (code, name, created_by_profile_id, updated_by_profile_id)
     values ($1, 'Týmovka', $2, $2) returning id`,
    [`R-${Math.random().toString(36).slice(2, 8)}`, manager.profileId],
  );
  const roomId = roomRows[0].id as string;

  for (const schedule of opts.schedules ?? [{ dayOfWeek: 1 }]) {
    await insertSchedule(client, teamId, manager.profileId, roomId, schedule);
  }

  const { rows: activityRows } = await client.query(
    `insert into public.team_activities
       (team_id, occurred_at, activity_type, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $4) returning id`,
    [teamId, date, opts.activityType ?? "training_session", manager.profileId],
  );

  return {
    teamId,
    managerId: manager.profileId,
    memberId: member.profileId,
    activityId: activityRows[0].id as string,
    roomId,
  };
}

async function markAttendance(client: PoolClient, f: Fixture, status: string, profileId?: string): Promise<string> {
  const { rows } = await client.query(
    `insert into public.team_activity_attendees
       (activity_id, profile_id, status, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $4, $4)
     on conflict (activity_id, profile_id) do update set status = excluded.status
     returning id`,
    [f.activityId, profileId ?? f.memberId, status, f.managerId],
  );
  return rows[0].id as string;
}

async function autoEntries(client: PoolClient, profileId: string) {
  const { rows } = await client.query(
    `select id, direction, title, source, attendance_id, started_at, ended_at, duration_ms,
            created_by_profile_id, updated_by_profile_id
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
    created_by_profile_id: string;
    updated_by_profile_id: string;
  }>;
}

describe("sync_training_session_time_entry — DST and day_of_week", () => {
  it("computes the window correctly across the DST fall-back weekend (Sunday, still CEST-adjacent date, but after 03:00 the zone is already CET)", async () => {
    await withRollback(async (client) => {
      // 2026-10-25 is a Sunday; the EU clock change happens at 03:00 local that night.
      // JS getDay() / extract(dow) both give 0 for Sunday.
      const f = await seedTeamWithTs(client, { date: "2026-10-25", schedules: [{ dayOfWeek: 0 }] });
      await markAttendance(client, f, "present");
      const entries = await autoEntries(client, f.memberId);
      expect(entries).toHaveLength(1);
      expect(entries[0].started_at.toISOString()).toBe("2026-10-25T07:00:00.000Z");
      expect(entries[0].ended_at?.toISOString()).toBe("2026-10-25T11:00:00.000Z");
      expect(Number(entries[0].duration_ms)).toBe(4 * HOUR_MS);
    });
  });

  it("computes the window correctly the Monday right after the DST fall-back (CET, UTC+1)", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client, { date: "2026-10-26", schedules: [{ dayOfWeek: 1 }] });
      await markAttendance(client, f, "present");
      const entries = await autoEntries(client, f.memberId);
      expect(entries).toHaveLength(1);
      expect(entries[0].started_at.toISOString()).toBe("2026-10-26T07:00:00.000Z");
      expect(entries[0].ended_at?.toISOString()).toBe("2026-10-26T11:00:00.000Z");
    });
  });

  it("uses CEST offset before the fall-back (contrast case, Monday 2026-09-21)", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client, { date: "2026-09-21", schedules: [{ dayOfWeek: 1 }] });
      await markAttendance(client, f, "present");
      const entries = await autoEntries(client, f.memberId);
      expect(entries[0].started_at.toISOString()).toBe("2026-09-21T06:00:00.000Z");
      expect(entries[0].ended_at?.toISOString()).toBe("2026-09-21T10:00:00.000Z");
    });
  });

  it("does not match a schedule with the wrong day_of_week (Sunday schedule vs. Monday activity)", async () => {
    await withRollback(async (client) => {
      // Activity is on Monday 2026-09-21 (dow 1) but the only schedule is for Sunday (dow 0).
      const f = await seedTeamWithTs(client, { date: "2026-09-21", schedules: [{ dayOfWeek: 0 }] });
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });

  it("picks the earliest of two same-weekday schedules and never creates two entries (documented limitation)", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client, {
        date: "2026-09-21",
        schedules: [
          { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" },
          { dayOfWeek: 1, startTime: "08:00", endTime: "12:00" },
        ],
      });
      await markAttendance(client, f, "present");
      const entries = await autoEntries(client, f.memberId);
      expect(entries).toHaveLength(1);
      // 08:00-12:00 local (the earlier of the two) wins, not 13:00-17:00.
      expect(entries[0].started_at.toISOString()).toBe("2026-09-21T06:00:00.000Z");
      expect(entries[0].ended_at?.toISOString()).toBe("2026-09-21T10:00:00.000Z");
    });
  });
});

describe("sync_training_session_time_entry — schedule validity window", () => {
  it("valid_until is inclusive of the activity's own date", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client, {
        date: "2026-09-21",
        schedules: [{ dayOfWeek: 1, validFrom: "2026-09-01", validUntil: "2026-09-21" }],
      });
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(1);
    });
  });

  it("creates nothing when valid_from is after the activity date", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client, {
        date: "2026-09-21",
        schedules: [{ dayOfWeek: 1, validFrom: "2026-09-22" }],
      });
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });

  it("creates nothing when valid_until is the day before the activity date", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client, {
        date: "2026-09-21",
        schedules: [{ dayOfWeek: 1, validFrom: "2026-01-01", validUntil: "2026-09-20" }],
      });
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });

  it("creates nothing when the matching schedule is soft-removed", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client, {
        date: "2026-09-21",
        schedules: [{ dayOfWeek: 1, removedAt: "2026-09-20T00:00:00Z" }],
      });
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });
});

describe("sync_training_session_time_entry — activity mutation after the fact", () => {
  it("does not retroactively delete the auto entry when the activity is soft-removed afterwards (documented: no cleanup on activity removal)", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await markAttendance(client, f, "present");
      expect(await autoEntries(client, f.memberId)).toHaveLength(1);

      await client.query(`update public.team_activities set removed_at = now() where id = $1`, [f.activityId]);

      expect(await autoEntries(client, f.memberId)).toHaveLength(1);
    });
  });

  it("does not move the auto entry when the activity's occurred_at is changed afterwards (documented: window is fixed at attendance-write time)", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await markAttendance(client, f, "present");
      const [before] = await autoEntries(client, f.memberId);

      await client.query(`update public.team_activities set occurred_at = '2026-09-22' where id = $1`, [f.activityId]);

      const [after] = await autoEntries(client, f.memberId);
      expect(after.started_at.toISOString()).toBe(before.started_at.toISOString());
      expect(after.started_at.toISOString()).toBe("2026-09-21T06:00:00.000Z");
    });
  });
});

describe("sync_training_session_time_entry — status transitions", () => {
  it("creates nothing for a member marked late", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await markAttendance(client, f, "late");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });

  it("creates nothing for a member marked excused", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      await markAttendance(client, f, "excused");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
    });
  });

  it("deletes then recreates exactly once across present -> late -> present", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);

      await markAttendance(client, f, "present");
      const [first] = await autoEntries(client, f.memberId);
      expect(first).toBeTruthy();

      await markAttendance(client, f, "late");
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);

      await markAttendance(client, f, "present");
      const afterSecond = await autoEntries(client, f.memberId);
      expect(afterSecond).toHaveLength(1);
      // A brand new row, not the same one resurrected.
      expect(afterSecond[0].id).not.toBe(first.id);
    });
  });
});

describe("sync_training_session_time_entry — overlap exclusion path", () => {
  it("creates no auto entry when a running timer already overlaps the window, and the attendance insert still succeeds", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      // Started before the 06:00Z window start, still running -> occupies [05:00, infinity).
      await insertRunningTimer(client, f.memberId, "2026-09-21T05:00:00Z");

      const attendanceId = await markAttendance(client, f, "present");
      const { rows: attendanceRows } = await client.query(
        `select status from public.team_activity_attendees where id = $1`,
        [attendanceId],
      );
      expect(attendanceRows[0].status).toBe("present");

      const entries = await autoEntries(client, f.memberId);
      expect(entries).toHaveLength(1);
      expect(entries[0].source).toBe("timer");
      expect(entries[0].ended_at).toBeNull();
    });
  });

  it("creates no auto entry when an existing entry only partially overlaps the window", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      // 11:30-13:00 Europe/Prague (CEST) on 2026-09-21 = 09:30-11:00Z; window is 06:00-10:00Z.
      await insertClosedEntry(client, f.memberId, "2026-09-21T09:30:00Z", "2026-09-21T11:00:00Z", { title: "Meeting" });

      await markAttendance(client, f, "present");

      const entries = await autoEntries(client, f.memberId);
      expect(entries).toHaveLength(1);
      expect(entries[0].source).toBe("manual");
      expect(entries[0].title).toBe("Meeting");
    });
  });
});

describe("sync_training_session_time_entry — multiple attendees and cascade", () => {
  it("creates one entry per attendee, and deleting the activity cascades attendees and entries away", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      const other = await seedMember(client, { teamId: f.teamId });

      const memberAttendanceId = await markAttendance(client, f, "present", f.memberId);
      const otherAttendanceId = await markAttendance(client, f, "present", other.profileId);

      const memberEntries = await autoEntries(client, f.memberId);
      const otherEntries = await autoEntries(client, other.profileId);
      expect(memberEntries).toHaveLength(1);
      expect(otherEntries).toHaveLength(1);
      expect(memberEntries[0].attendance_id).toBe(memberAttendanceId);
      expect(otherEntries[0].attendance_id).toBe(otherAttendanceId);

      await client.query(`delete from public.team_activities where id = $1`, [f.activityId]);

      const { rows: remainingAttendees } = await client.query(
        `select id from public.team_activity_attendees where activity_id = $1`,
        [f.activityId],
      );
      expect(remainingAttendees).toHaveLength(0);
      expect(await autoEntries(client, f.memberId)).toHaveLength(0);
      expect(await autoEntries(client, other.profileId)).toHaveLength(0);
    });
  });
});

describe("sync_training_session_time_entry — runs as SECURITY DEFINER under RLS", () => {
  it("attributes the auto entry to the attendee, not to the (different) team member who recorded attendance", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      // A third, unrelated team member records attendance for `member` via RLS as a regular student
      // (not the coach/admin, not the attendee). The "Team members can create activity attendees"
      // policy allows any team member to do this.
      const recorder = await seedMember(client, { teamId: f.teamId });

      await asClaims(client, { sub: recorder.authUserId });
      const attendanceId = await markAttendance(client, f, "present", f.memberId);

      const entries = await autoEntries(client, f.memberId);
      expect(entries).toHaveLength(1);
      expect(entries[0].attendance_id).toBe(attendanceId);
      expect(entries[0].created_by_profile_id).toBe(f.memberId);
      expect(entries[0].updated_by_profile_id).toBe(f.memberId);
      expect(entries[0].created_by_profile_id).not.toBe(recorder.profileId);
    });
  });
});

// ---------------------------------------------------------------------------
// RLS — roles beyond the happy path already covered elsewhere
// ---------------------------------------------------------------------------

describe("time_entries RLS — mentor role and team edge cases", () => {
  it("mentor sees own entries and own team's entries, but not another team's", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const teamB = await seedTeam(client, "TIMACE");
      const mentor = await seedMember(client, { teamId: teamA, role: "mentor" });
      const teammate = await seedMember(client, { teamId: teamA });
      const stranger = await seedMember(client, { teamId: teamB });

      const ownEntryId = await insertClosedEntry(client, mentor.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");
      const teammateEntryId = await insertClosedEntry(client, teammate.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");
      const strangerEntryId = await insertClosedEntry(client, stranger.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");

      await asClaims(client, { sub: mentor.authUserId });
      const { rowCount: ownSeen } = await client.query(`select id from public.time_entries where id = $1`, [ownEntryId]);
      const { rowCount: teammateSeen } = await client.query(`select id from public.time_entries where id = $1`, [teammateEntryId]);
      const { rowCount: strangerSeen } = await client.query(`select id from public.time_entries where id = $1`, [strangerEntryId]);

      expect(ownSeen).toBe(1);
      expect(teammateSeen).toBe(1);
      expect(strangerSeen).toBe(0);
    });
  });

  it("hides entries of a teammate whose access has been removed", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const viewer = await seedMember(client, { teamId: teamA });
      const removed = await seedMember(client, { teamId: teamA });
      const entryId = await insertClosedEntry(client, removed.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");

      // The pool role is the container's `test` user, which validate_picture_only_update
      // does not trust; elevate to service_role for the admin-style column change.
      await client.query("set local role service_role");
      await client.query(`update public.profiles set access_removed_at = now() where id = $1`, [removed.profileId]);
      await client.query("reset role");
      // Guard the precondition so a failure points at the harness, not at RLS.
      const { rows: check } = await client.query(
        `select access_removed_at is not null as removed, team_id from public.profiles where id = $1`,
        [removed.profileId],
      );
      expect(check[0]).toMatchObject({ removed: true, team_id: teamA });

      await asClaims(client, { sub: viewer.authUserId });
      const { rowCount } = await client.query(`select id from public.time_entries where id = $1`, [entryId]);
      expect(rowCount).toBe(0);
    });
  });

  it("stops seeing a former team's entries once the profile has moved to a new team", async () => {
    await withRollback(async (client) => {
      const oldTeam = await seedTeam(client, "BASED");
      const newTeam = await seedTeam(client, "TIMACE");
      const mover = await seedMember(client, { teamId: oldTeam });
      const oldTeammate = await seedMember(client, { teamId: oldTeam });
      const oldEntryId = await insertClosedEntry(client, oldTeammate.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");

      // Team change: elevate to service_role (the pattern used for team-move workflows elsewhere,
      // e.g. tests/integration/team-membership.int.test.ts), since `authenticated` may not touch
      // team_id directly and this must happen before asClaims flips the role anyway.
      await client.query("set local role service_role");
      await client.query(
        `update public.profiles set team_id = $2, former_team_id = $3, team_left_at = now() where id = $1`,
        [mover.profileId, newTeam, oldTeam],
      );
      await client.query("reset role");

      await asClaims(client, { sub: mover.authUserId });
      const { rowCount } = await client.query(`select id from public.time_entries where id = $1`, [oldEntryId]);
      expect(rowCount).toBe(0);
    });
  });

  it("a student without a team sees only their own entries", async () => {
    await withRollback(async (client) => {
      const teamA = await seedTeam(client, "BASED");
      const loner = await seedMember(client, { teamId: null });
      const stranger = await seedMember(client, { teamId: teamA });

      const ownId = await insertClosedEntry(client, loner.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");
      const strangerId = await insertClosedEntry(client, stranger.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");

      await asClaims(client, { sub: loner.authUserId });
      const { rowCount: ownSeen } = await client.query(`select id from public.time_entries where id = $1`, [ownId]);
      const { rowCount: strangerSeen } = await client.query(`select id from public.time_entries where id = $1`, [strangerId]);
      expect(ownSeen).toBe(1);
      expect(strangerSeen).toBe(0);
    });
  });
});

describe("time_entries RLS — coach and admin write scope", () => {
  it.each([["coach"], ["admin"]] as const)(
    "%s can read another profile's entry but insert/update/delete on it affect nothing",
    async (role) => {
      await withRollback(async (client) => {
        const teamA = await seedTeam(client, "BASED");
        const owner = await seedMember(client, { teamId: teamA });
        const staff = await seedMember(client, { role });
        const entryId = await insertClosedEntry(client, owner.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z");

        await asClaims(client, { sub: staff.authUserId });

        const { rowCount: sees } = await client.query(`select id from public.time_entries where id = $1`, [entryId]);
        expect(sees).toBe(1);

        const { rowCount: updates } = await client.query(`update public.time_entries set title = 'staff edit' where id = $1`, [entryId]);
        expect(updates).toBe(0);

        const { rowCount: deletes } = await client.query(`delete from public.time_entries where id = $1`, [entryId]);
        expect(deletes).toBe(0);

        // INSERT is different: WITH CHECK fails outright rather than silently affecting 0 rows.
        await client.query("savepoint staff_insert");
        const insertCode = await errorCode(insertClosedEntry(client, owner.profileId, "2026-09-21T10:00:00Z", "2026-09-21T11:00:00Z"));
        await client.query("rollback to savepoint staff_insert");
        expect(insertCode).toBe(INSUFFICIENT_PRIVILEGE);
      });
    },
  );
});

// ---------------------------------------------------------------------------
// Exclusion constraint interplay with a running timer
// ---------------------------------------------------------------------------

describe("time_entries exclusion constraint with a running timer", () => {
  it("allows a closed entry that ends before the running timer starts", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      await insertRunningTimer(client, me.profileId, "2026-09-21T10:00:00Z");
      await expect(
        insertClosedEntry(client, me.profileId, "2026-09-21T07:00:00Z", "2026-09-21T08:00:00Z"),
      ).resolves.toBeTruthy();
    });
  });

  it("rejects a closed entry that starts at or after the running timer's start", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      await insertRunningTimer(client, me.profileId, "2026-09-21T10:00:00Z");

      await client.query("savepoint after_start");
      const code = await errorCode(insertClosedEntry(client, me.profileId, "2026-09-21T10:30:00Z", "2026-09-21T11:30:00Z"));
      await client.query("rollback to savepoint after_start");
      expect(code).toBe(EXCLUSION_VIOLATION);
    });
  });

  it("rejects moving the running timer's start backwards over an existing closed entry", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      await insertClosedEntry(client, me.profileId, "2026-09-21T07:00:00Z", "2026-09-21T08:00:00Z");
      const runningId = await insertRunningTimer(client, me.profileId, "2026-09-21T10:00:00Z");

      await client.query("savepoint move_back");
      const code = await errorCode(
        client.query(`update public.time_entries set started_at = '2026-09-21T07:30:00Z' where id = $1`, [runningId]),
      );
      await client.query("rollback to savepoint move_back");
      expect(code).toBe(EXCLUSION_VIOLATION);
    });
  });
});

// ---------------------------------------------------------------------------
// duration_ms check constraint
// ---------------------------------------------------------------------------

describe("time_entries_duration_matches check", () => {
  it("rejects a closed entry with a null duration_ms", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      const code = await errorCode(
        client.query(
          `insert into public.time_entries (profile_id, direction, started_at, ended_at, duration_ms, source, created_by_profile_id, updated_by_profile_id)
           values ($1, 'practise', '2026-09-21T08:00:00Z', '2026-09-21T09:00:00Z', null, 'manual', $1, $1)`,
          [me.profileId],
        ),
      );
      expect(code).toBe(CHECK_VIOLATION);
    });
  });

  it("rejects a closed entry whose duration_ms does not match ended_at - started_at", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      const code = await errorCode(
        client.query(
          `insert into public.time_entries (profile_id, direction, started_at, ended_at, duration_ms, source, created_by_profile_id, updated_by_profile_id)
           values ($1, 'practise', '2026-09-21T08:00:00Z', '2026-09-21T09:00:00Z', 1, 'manual', $1, $1)`,
          [me.profileId],
        ),
      );
      expect(code).toBe(CHECK_VIOLATION);
    });
  });
});

// ---------------------------------------------------------------------------
// Cascades and uniqueness beyond the tag-delete case already covered
// ---------------------------------------------------------------------------

describe("time_entries cascades and uniqueness", () => {
  it("cascades a profile's own entries and tags when the profile is deleted", async () => {
    await withRollback(async (client) => {
      const me = await seedMember(client);
      const { rows: tagRows } = await client.query(
        `insert into public.time_tags (profile_id, name, created_by_profile_id, updated_by_profile_id)
         values ($1, 'fellaship', $1, $1) returning id`,
        [me.profileId],
      );
      const tagId = tagRows[0].id as string;
      await insertClosedEntry(client, me.profileId, "2026-09-21T08:00:00Z", "2026-09-21T09:00:00Z", { tagId });

      await client.query(`delete from public.profiles where id = $1`, [me.profileId]);

      const { rows: entries } = await client.query(`select id from public.time_entries where profile_id = $1`, [me.profileId]);
      const { rows: tags } = await client.query(`select id from public.time_tags where id = $1`, [tagId]);
      expect(entries).toHaveLength(0);
      expect(tags).toHaveLength(0);
    });
  });

  it("enforces attendance_id uniqueness at the database level", async () => {
    await withRollback(async (client) => {
      const f = await seedTeamWithTs(client);
      const attendanceId = await markAttendance(client, f, "present");
      // The trigger already inserted one row for this attendance_id; a second manual insert
      // reusing the same attendance_id must be rejected by the partial unique index.
      const code = await errorCode(
        client.query(
          `insert into public.time_entries
             (profile_id, direction, started_at, ended_at, duration_ms, source, attendance_id, created_by_profile_id, updated_by_profile_id)
           values ($1, 'training', '2026-09-22T06:00:00Z', '2026-09-22T10:00:00Z', 14400000, 'attendance', $2, $1, $1)`,
          [f.memberId, attendanceId],
        ),
      );
      expect(code).toBe(UNIQUE_VIOLATION);
    });
  });
});
