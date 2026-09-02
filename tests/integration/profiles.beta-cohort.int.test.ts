import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertVerifiedProfile } from "@/tests/setup/factories";

describe("profiles beta_cohort trigger", () => {
  it("prevents authenticated user from updating beta_cohort", async () => {
    await withRollback(async (client) => {
      const { authUserId, profileId } = await insertVerifiedProfile(client, {
        name: "Student Beta",
        email: "student-beta-cohort@studenti.czu.cz",
      });

      await asClaims(client, { sub: authUserId });

      await expect(
        client.query("update public.profiles set beta_cohort = 'B' where id = $1", [profileId]),
      ).rejects.toThrow(/Only picture and beta_access_granted_at/);
    });
  });

  it("allows service_role to update beta_cohort", async () => {
    await withRollback(async (client) => {
      const { profileId } = await insertVerifiedProfile(client, {
        name: "Student Beta Svc",
        email: "student-beta-svc@studenti.czu.cz",
      });

      // Simulate service_role session - trigger bypass checks role / jwt claim
      await client.query("select set_config('role', 'service_role', true)");
      await client.query("select set_config('request.jwt.claim.role', 'service_role', true)");
      await client.query("set local role service_role");

      const { rows } = await client.query(
        "update public.profiles set beta_cohort = 'B' where id = $1 returning beta_cohort",
        [profileId],
      );
      expect(rows[0].beta_cohort).toBe("B");
    });
  });
});
