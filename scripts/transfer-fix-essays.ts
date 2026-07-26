import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCAL_URL = "http://127.0.0.1:54321";
const PREVIEW_URL = "https://wykcqwmrxvgoomltrrlo.supabase.co";
const LK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PK = process.env.PREVIEW_SERVICE_ROLE_KEY ?? "";
const LOCAL_STORAGE = LOCAL_URL + "/storage/v1/object/public/images";
const PREVIEW_STORAGE = PREVIEW_URL + "/storage/v1/object/public/images";
const IMAGES_DIR = resolve(__dirname, "essayimport/Downloaded_Images");
const IMAGE_MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };

const H = (k: string) => ({ "apikey": k, "Authorization": `Bearer ${k}`, "Content-Type": "application/json" });

async function get(table: string, sel = "*"): Promise<any[]> {
  const all: any[] = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${LOCAL_URL}/rest/v1/${table}?select=${encodeURIComponent(sel)}&limit=1000&offset=${off}`, { headers: H(LK) });
    const rows = await r.json();
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

async function ps(table: string, body: unknown): Promise<boolean> {
  const r = await fetch(`${PREVIEW_URL}/rest/v1/${table}`, { method: "POST", headers: { ...H(PK), "Prefer": "return=minimal" }, body: JSON.stringify(body) });
  return r.ok;
}

async function pb(table: string, rows: any[]): Promise<number> {
  const r = await fetch(`${PREVIEW_URL}/rest/v1/${table}`, { method: "POST", headers: { ...H(PK), "Prefer": "return=minimal" }, body: JSON.stringify(rows) });
  if (r.ok) return rows.length;
  let ok = 0;
  for (const row of rows) { if (await ps(table, row)) ok++; }
  return ok;
}

async function del(table: string) {
  const col = table === "essay_revisions" ? "essay_id" : "id";
  await fetch(`${PREVIEW_URL}/rest/v1/${table}?${col}=neq.00000000-0000-0000-0000-000000000000&limit=100000`, { method: "DELETE", headers: H(PK) });
}

async function main() {
  if (!PK) { console.error("PREVIEW_SERVICE_ROLE_KEY required"); process.exit(1); }

  for (const t of ["essay_comments", "essay_revisions", "essays"]) { await del(t); console.log(`cleared ${t}`); }

  // Essays
  const essays = await get("essays");
  console.log(`Essays: ${essays.length}`);
  let ok = 0, err = 0;
  for (let i = 0; i < essays.length; i += 200) {
    const batch = essays.slice(i, i + 200).map((r: any) => { const { created_at, updated_at, ...rest } = r; return rest; });
    const n = await pb("essays", batch);
    ok += n; err += batch.length - n;
  }
  console.log(`  ${ok} ok, ${err} errors`);

  // Revisions
  const revs = await get("essay_revisions");
  console.log(`Revisions: ${revs.length}`);
  ok = 0; err = 0; let imgs = 0;
  for (let i = 0; i < revs.length; i += 200) {
    const batch: any[] = [];
    for (const rev of revs.slice(i, i + 200)) {
      let s = JSON.stringify(rev.content_json);
      if (s.includes(LOCAL_STORAGE)) {
        const ms = s.match(new RegExp(`${escapeRegex(LOCAL_STORAGE)}/([^"']+)`, "g"));
        if (ms) for (const u of [...new Set(ms)]) {
          const sp = u.replace(`${LOCAL_STORAGE}/`, "");
          const pu = `${PREVIEW_STORAGE}/${sp}`;
          const parts = sp.replace("essay-images/import/", "").split("/");
          if (parts.length === 2) {
            const lf = resolve(IMAGES_DIR, `${parts[0]}_${parts[1]}`);
            if (existsSync(lf)) {
              const mime = IMAGE_MIME[extname(lf).toLowerCase()] ?? "image/jpeg";
              await fetch(`${PREVIEW_URL}/storage/v1/object/images/${sp}`, { method: "POST", headers: { "Authorization": `Bearer ${PK}`, "Content-Type": mime, "x-upsert": "true" }, body: readFileSync(lf) });
              imgs++;
            }
          }
          s = s.replace(u, pu);
        }
      }
      const { created_at, updated_at, ...rest } = rev;
      batch.push({ ...rest, content_json: JSON.parse(s) });
    }
    const n = await pb("essay_revisions", batch);
    ok += n; err += batch.length - n;
  }
  console.log(`  ${ok} ok, ${err} errors, ${imgs} images`);

  // Comments
  const comments = await get("essay_comments");
  console.log(`Comments: ${comments.length}`);
  ok = 0; err = 0;
  for (let i = 0; i < comments.length; i += 200) {
    const batch = comments.slice(i, i + 200).map((r: any) => { const { created_at, updated_at, ...rest } = r; return rest; });
    const n = await pb("essay_comments", batch);
    ok += n; err += batch.length - n;
  }
  console.log(`  ${ok} ok, ${err} errors`);

  // Verify
  console.log("\nVerify:");
  for (const t of ["essays", "essay_revisions", "essay_comments"]) {
    const loc = await get(t);
    const prev = await (await fetch(`${PREVIEW_URL}/rest/v1/${t}?select=count`, { headers: { ...H(PK), "Accept": "application/json" } })).json();
    console.log(`  ${t}: local=${loc.length} preview=${prev?.[0]?.count ?? "?"}`);
  }
  console.log("\nDone");
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
main().catch((e) => { console.error(e); process.exit(1); });