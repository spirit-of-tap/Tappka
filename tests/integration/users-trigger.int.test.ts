import { describe, expect, it } from "vitest";
import { withRollback } from "@/tests/setup/tx";
import { asClaims } from "@/tests/setup/rls";
import { insertAuthUser } from "@/tests/setup/factories";

describe("public.users RLS + auth trigger", () => {
  it("mirrors a new auth user into public.users", async () => {
    await withRollback(async (client) => {
      const user = await insertAuthUser(client, { email: "trigger@example.com" });
      const { rows } = await client.query(
        "select auth_user_id, google_email from public.users where auth_user_id = $1",
        [user.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].google_email).toBe("trigger@example.com");
    });
  });

  it("lets an authenticated user read only their own row", async () => {
    await withRollback(async (client) => {
      const me = await insertAuthUser(client);
      const other = await insertAuthUser(client);

      await asClaims(client, { sub: me.id });
      const { rows } = await client.query("select auth_user_id from public.users");

      const visible = rows.map((r: { auth_user_id: string }) => r.auth_user_id);
      expect(visible).toContain(me.id);
      expect(visible).not.toContain(other.id);
    });
  });
});
