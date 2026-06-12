// drizzle-pull.config.ts — temporary, used only for the one-time introspection
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./drizzle-pull",
  schemaFilter: ["public"],
  entities: {
    roles: {
      provider: "supabase",
    },
  },
  dbCredentials: {
    url: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
});
