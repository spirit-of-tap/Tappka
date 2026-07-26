import { describe, expect, it } from "vitest";
import { getPool } from "@/tests/setup/testdb";

describe("migrations", () => {
  it("apply cleanly and produce the public.users table", async () => {
    const { rows } = await getPool().query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = 'users'`,
    );
    expect(rows).toHaveLength(1);
  });

  it("create the reservations table", async () => {
    const { rows } = await getPool().query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_name = 'reservations'`,
    );
    expect(rows).toHaveLength(1);
  });
});
