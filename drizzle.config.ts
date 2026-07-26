import { defineConfig } from "drizzle-kit";

// Schema-management only: drizzle-kit diffs db/schema/*.ts against the
// snapshot in supabase/migrations/meta and writes timestamped migration
// files that the Supabase CLI applies. The app never connects via Drizzle.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema",
  out: "./supabase/migrations",
  schemaFilter: ["public"],
  migrations: {
    prefix: "supabase",
  },
  entities: {
    roles: {
      provider: "supabase",
    },
  },
  dbCredentials: {
    // Local Supabase stack only — never point this at production.
    url: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
  verbose: true,
  strict: true,
});
