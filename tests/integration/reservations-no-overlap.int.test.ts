import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import type { PoolClient } from "pg";

async function seedProfile(client: PoolClient): Promise<string> {
  const { rows } = await client.query(
    `insert into public.profiles (work_email, role)
     values ('overlap-' || floor(random()*1000000)::text || '@studenti.czu.cz', 'admin')
     returning id`,
  );
  return rows[0].id as string;
}

async function seedRoom(client: PoolClient, profileId: string): Promise<string> {
  const code = "t" + Math.floor(Math.random() * 1000000).toString();
  const { rows } = await client.query(
    `insert into public.rooms (code, name, created_by_profile_id, updated_by_profile_id)
     values ($1, $2, $3, $3) returning id`,
    [code, code, profileId],
  );
  return rows[0].id as string;
}

async function insertReservation(
  client: PoolClient,
  roomId: string,
  profileId: string,
  startAt: string,
  endAt: string,
) {
  const { rows } = await client.query(
    `insert into public.reservations
       (room_id, title, start_at, end_at, created_by_profile_id, updated_by_profile_id)
     values ($1, 'Team Mastery', $2, $3, $4, $4) returning id`,
    [roomId, startAt, endAt, profileId],
  );
  return rows[0].id as string;
}

describe("reservations no_overlap", () => {
  it("blocks overlapping active reservations", async () => {
    await withRollback(async (client) => {
      const profileId = await seedProfile(client);
      const roomId = await seedRoom(client, profileId);
      await insertReservation(
        client,
        roomId,
        profileId,
        "2026-10-26T12:00:00Z",
        "2026-10-26T14:00:00Z",
      );
      await expect(
        insertReservation(client, roomId, profileId, "2026-10-26T12:00:00Z", "2026-10-26T16:00:00Z"),
      ).rejects.toThrow(/no_overlap|23P01/);
    });
  });

  it("allows overlapping once the old reservation is cancelled", async () => {
    await withRollback(async (client) => {
      const profileId = await seedProfile(client);
      const roomId = await seedRoom(client, profileId);
      const oldId = await insertReservation(
        client,
        roomId,
        profileId,
        "2026-10-26T12:00:00Z",
        "2026-10-26T14:00:00Z",
      );
      await client.query(
        `update public.reservations set cancelled_at = now(), cancelled_by_profile_id = $2 where id = $1`,
        [oldId, profileId],
      );
      const newId = await insertReservation(
        client,
        roomId,
        profileId,
        "2026-10-26T12:00:00Z",
        "2026-10-26T16:00:00Z",
      );
      expect(newId).toBeDefined();
    });
  });
});
