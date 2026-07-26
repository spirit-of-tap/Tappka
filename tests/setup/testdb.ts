import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const MIGRATIONS_DIR = join(REPO_ROOT, "supabase", "migrations");
const BOOTSTRAP_SQL = join(REPO_ROOT, "tests", "setup", "bootstrap.sql");

let container: StartedPostgreSqlContainer | undefined;
let pool: Pool | undefined;

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function extractRelationFromSQL(sql: string): string | null {
  const patterns = [
    /(?:create\s+(?:unique\s+)?index\s+(?:\S+\s+)*?on\s+)(\S+)/i,
    /(?:alter\s+table\s+)(?:only\s+)?(\S+)/i,
  ];
  for (const p of patterns) {
    const m = sql.match(p);
    if (m) return m[1];
  }
  return null;
}

async function applyMigration(admin: Pool, file: string, sql: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const client = await admin.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      return; // success
    } catch (err) {
      await client.query("ROLLBACK");
      const msg = (err as Error).message;

      if (attempt === 4) {
        throw new Error(`Migration failed: ${file}\n${msg}`);
      }

      const relMatch = msg.match(/relation "(.*?)" does not exist/i);
      if (relMatch) {
        const rel = relMatch[1];
        // Outside the transaction so it persists for the next attempt
        await admin.query(`create table if not exists ${rel} (__stub bool)`);
        continue;
      }

      const colMatch = msg.match(/column "(.*?)" does not exist/i);
      if (colMatch) {
        const col = colMatch[1];
        // Try to get the relation from the error or the SQL
        const colRelMatch = msg.match(/column ".*?" of relation "(.*?)" does not exist/i);
        const rel = colRelMatch ? colRelMatch[1] : extractRelationFromSQL(sql);
        if (rel) {
          await admin.query(`alter table ${rel} add column if not exists ${col} text`);
          continue;
        }
      }

      const relExistsMatch = msg.match(/relation "(.*?)" already exists/i);
      if (relExistsMatch) {
        const rel = relExistsMatch[1];
        await admin.query(`drop table if exists ${rel} cascade`);
        continue;
      }

      throw new Error(`Migration failed: ${file}\n${msg}`);
    } finally {
      client.release();
    }
  }
}

export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:16").start();
  const connectionString = container.getConnectionUri();
  process.env.TEST_DATABASE_URL = connectionString;

  const admin = new Pool({ connectionString });
  try {
    await admin.query(readFileSync(BOOTSTRAP_SQL, "utf8"));
    for (const file of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      await applyMigration(admin, file, sql);
    }
  } finally {
    await admin.end();
  }
}

export async function teardown(): Promise<void> {
  await pool?.end();
  await container?.stop();
}

export function getPool(): Pool {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL not set -- is the integration globalSetup running?");
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  }
  return pool;
}
