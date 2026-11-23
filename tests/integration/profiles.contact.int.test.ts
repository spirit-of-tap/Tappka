import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertVerifiedProfile } from "@/tests/setup/factories";

describe("profiles contact trigger", () => {
  it("allows owner to update own phone, personal email and date of birth", async () => {
    await withRollback(async (client) => {
      const { authUserId, profileId } = await insertVerifiedProfile(client, { email: "contact-owner@studenti.czu.cz" });
      await asClaims(client, { sub: authUserId });
      const { rows } = await client.query(
        `update public.profiles
            set phone_number = '+420 777 123 456', personal_email = 'jmeno@gmail.com', date_of_birth = '2003-05-17'
          where id = $1
          returning phone_number, personal_email, to_char(date_of_birth, 'YYYY-MM-DD') as date_of_birth`,
        [profileId],
      );
      expect(rows[0]).toEqual({
        phone_number: "+420 777 123 456",
        personal_email: "jmeno@gmail.com",
        date_of_birth: "2003-05-17",
      });
    });
  });

  it("still blocks owner from changing work_email", async () => {
    await withRollback(async (client) => {
      const { authUserId, profileId } = await insertVerifiedProfile(client, { email: "contact-work@studenti.czu.cz" });
      await asClaims(client, { sub: authUserId });
      await expect(
        client.query("update public.profiles set work_email = 'jiny@studenti.czu.cz' where id = $1", [profileId]),
      ).rejects.toThrow(/Only picture, bio_json, contact fields and beta_access_granted_at/);
    });
  });

  it("blocks one user from updating another profile contact", async () => {
    await withRollback(async (client) => {
      const a = await insertVerifiedProfile(client, { email: "contact-a@studenti.czu.cz" });
      const b = await insertVerifiedProfile(client, { email: "contact-b@studenti.czu.cz" });
      await asClaims(client, { sub: a.authUserId });
      const res = await client.query("update public.profiles set phone_number = '+420 777 000 000' where id = $1 returning id", [
        b.profileId,
      ]);
      expect(res.rowCount).toBe(0);
    });
  });
});
