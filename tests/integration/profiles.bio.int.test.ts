import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertVerifiedProfile } from "@/tests/setup/factories";

const BIO = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ahoj!' }] }] };

describe("profiles bio trigger", () => {
  it("allows owner to update own bio_json", async () => {
    await withRollback(async (client) => {
      const { authUserId, profileId } = await insertVerifiedProfile(client, { email: "bio-owner@studenti.czu.cz" });
      await asClaims(client, { sub: authUserId });
      const { rows } = await client.query(
        "update public.profiles set bio_json = $2 where id = $1 returning bio_json",
        [profileId, JSON.stringify(BIO)],
      );
      expect(rows[0].bio_json).toMatchObject({ type: 'doc' });
    });
  });

  it("still blocks owner from updating name", async () => {
    await withRollback(async (client) => {
      const { authUserId, profileId } = await insertVerifiedProfile(client, { email: "bio-block@studenti.czu.cz" });
      await asClaims(client, { sub: authUserId });
      await expect(
        client.query("update public.profiles set name = 'X' where id = $1", [profileId]),
      ).rejects.toThrow(/Only picture, bio_json and beta_access_granted_at/);
    });
  });

  it("blocks one user from updating another profile bio via RLS/trigger", async () => {
    await withRollback(async (client) => {
      const a = await insertVerifiedProfile(client, { email: "bio-a@studenti.czu.cz" });
      const b = await insertVerifiedProfile(client, { email: "bio-b@studenti.czu.cz" });
      await asClaims(client, { sub: a.authUserId });
      const res = await client.query(
        "update public.profiles set bio_json = $2 where id = $1 returning id",
        [b.profileId, JSON.stringify(BIO)],
      );
      expect(res.rowCount).toBe(0);
    });
  });
});
