import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const LOCAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const PREVIEW_URL = "https://wykcqwmrxvgoomltrrlo.supabase.co";
const PREVIEW_KEY = process.env.PREVIEW_SERVICE_ROLE_KEY ?? "";

const LOCAL_STORAGE_PREFIX = "http://127.0.0.1:54321/storage/v1/object/public/images";
const PREVIEW_STORAGE_PREFIX = `${PREVIEW_URL}/storage/v1/object/public/images`;

const KNOWN_PROFILE_UUIDS = new Set([
  "cef56f02-90a4-4f46-8ff4-595975c76791",
  "ef3f6001-f1f7-4464-8d0f-01b3ffc89bd6",
  "02ac1206-17e3-489c-8802-515eb7bbcb7f",
]);

const IMAGES_DIR = resolve(__dirname, "essayimport/Downloaded_Images");
const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
};

const auth = (key: string) => ({ "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" });

async function getLocal(table: string, select = "*"): Promise<any[]> {
  const all: any[] = [];
  const limit = 1000;
  let offset = 0;
  while (true) {
    const url = `${LOCAL_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { headers: auth(LOCAL_KEY) });
    if (!res.ok) throw new Error(`GET ${table}: ${res.status}`);
    const rows: any[] = await res.json();
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return all;
}

async function postPreview(table: string, body: unknown): Promise<boolean> {
  const res = await fetch(`${PREVIEW_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...auth(PREVIEW_KEY), "Prefer": "return=minimal" },
    body: JSON.stringify(body),
  });
  if (res.ok) return true;
  const text = await res.text().catch(() => "");
  if (text.includes("23505")) return false;
  return false;
}

async function postPreviewBatch(table: string, rows: any[]): Promise<number> {
  const res = await fetch(`${PREVIEW_URL}/rest/v1/${table}`, {
    method: "POST", headers: { ...auth(PREVIEW_KEY), "Prefer": "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (res.ok) return rows.length;
  // Fall back to individual inserts
  let ok = 0;
  for (const row of rows) { if (await postPreview(table, row)) ok++; }
  return ok;
}

async function uploadImage(localFile: string, storagePath: string): Promise<string | null> {
  if (!existsSync(localFile)) return null;
  const mime = IMAGE_MIME[extname(localFile).toLowerCase()] ?? "image/jpeg";
  const res = await fetch(`${PREVIEW_URL}/storage/v1/object/images/${storagePath}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${PREVIEW_KEY}`, "Content-Type": mime, "x-upsert": "true" },
    body: readFileSync(localFile),
  });
  return res.ok ? `${PREVIEW_STORAGE_PREFIX}/${storagePath}` : null;
}

async function deletePreview(table: string): Promise<void> {
  const col = table === "book_tags" ? "book_id" : table === "essay_revisions" ? "essay_id" : "id";
  await fetch(`${PREVIEW_URL}/rest/v1/${table}?${col}=neq.00000000-0000-0000-0000-000000000000&limit=100000`, {
    method: "DELETE", headers: auth(PREVIEW_KEY),
  });
}

async function countPreview(table: string): Promise<number> {
  const res = await fetch(`${PREVIEW_URL}/rest/v1/${table}?select=count`, {
    headers: { ...auth(PREVIEW_KEY), "Accept": "application/json" },
  });
  if (!res.ok) return -1;
  const data: any = await res.json();
  return data?.[0]?.count ?? data?.length ?? -1;
}

async function transferWithBatch(table: string, filter?: (row: any) => boolean) {
  console.log(`  Reading ${table}...`);
  const rows = await getLocal(table);
  console.log(`  ${rows.length} rows`);

  let ok = 0, err = 0;
  const CHUNK = 200;
  const batch: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (filter && !filter(row)) { ok++; continue; }
    const { created_at, updated_at, ...insert } = row;
    batch.push(insert);

    if (batch.length >= CHUNK || i === rows.length - 1) {
      const count = await postPreviewBatch(table, batch);
      ok += count;
      err += batch.length - count;
      batch.length = 0;
    }
    if ((i + 1) % 500 === 0) process.stdout.write(`\r    ${i + 1}/${rows.length} (${err} errors)`);
  }
  console.log(`\r    ${rows.length}/${rows.length} — ${ok} ok, ${err} errors`);
}

async function main() {
  if (!PREVIEW_KEY) { console.error("PREVIEW_SERVICE_ROLE_KEY required"); process.exit(1); }

  // ─── Clear preview ───
  console.log("=== Clearing preview ===");
  for (const t of ["essay_comments", "essay_revisions", "essays", "book_tags", "tags", "books"]) {
    try { await deletePreview(t); console.log(`  ✓ ${t} cleared`); } catch { console.log(`  ⚠ ${t} empty`); }
  }
  const uuids = [...KNOWN_PROFILE_UUIDS].join(",");
  await fetch(`${PREVIEW_URL}/rest/v1/profiles?id=not.in.(${uuids})&limit=100000`, {
    method: "DELETE", headers: auth(PREVIEW_KEY),
  });
  console.log("  ✓ imported profiles deleted");
  try { await deletePreview("teams"); console.log("  ✓ teams cleared"); } catch {}

  // ─── Transfer data ───
  console.log("\n=== Transferring data ===");
  await transferWithBatch("teams");
  await transferWithBatch("profiles", (p) => !KNOWN_PROFILE_UUIDS.has(p.id));
  await transferWithBatch("books");
  await transferWithBatch("tags");
  await transferWithBatch("book_tags");
  await transferWithBatch("essays");

  // ─── Essay revisions with image handling ───
  console.log("\n=== Revising essay_revisions ===");
  const revisions = await getLocal("essay_revisions");
  console.log(`  ${revisions.length} revisions`);
  let imgOk = 0, posted = 0, errors = 0;

  for (let i = 0; i < revisions.length; i += 200) {
    const chunk = revisions.slice(i, i + 200);
    const batch: any[] = [];
    for (const rev of chunk) {
      let jsonStr = JSON.stringify(rev.content_json);
      if (jsonStr.includes(LOCAL_STORAGE_PREFIX)) {
        const matches = jsonStr.match(new RegExp(`${escapeRegex(LOCAL_STORAGE_PREFIX)}/([^"']+)`, "g"));
        if (matches) {
          for (const oldUrl of [...new Set(matches)]) {
            const storagePath = oldUrl.replace(`${LOCAL_STORAGE_PREFIX}/`, "");
            const previewUrl = `${PREVIEW_STORAGE_PREFIX}/${storagePath}`;
            const parts = storagePath.replace("essay-images/import/", "").split("/");
            if (parts.length === 2) {
              const localFile = resolve(IMAGES_DIR, `${parts[0]}_${parts[1]}`);
              const uploaded = await uploadImage(localFile, storagePath);
              if (uploaded) imgOk++;
            }
            jsonStr = jsonStr.replace(oldUrl, previewUrl);
          }
        }
      }
      const { created_at, updated_at, ...rest } = rev;
      batch.push({ ...rest, content_json: JSON.parse(jsonStr) });
    }
    const count = await postPreviewBatch("essay_revisions", batch);
    posted += count;
    errors += batch.length - count;
    process.stdout.write(`\r    ${Math.min(i + 200, revisions.length)}/${revisions.length} — ${imgOk} images, ${errors} errors`);
  }
  console.log(`\r    ${revisions.length}/${revisions.length} — ${imgOk} images uploaded`);

  await transferWithBatch("essay_comments");

  // ─── Verify ───
  console.log("\n=== Verification ===");
  for (const t of ["teams", "profiles", "books", "tags", "book_tags", "essays", "essay_revisions", "essay_comments"]) {
    const local = await getLocal(t);
    const preview = await countPreview(t);
    const match = local.length === preview ? "✓" : "⚠";
    console.log(`  ${match} ${t}: local=${local.length} preview=${preview}`);
  }
  console.log("\n✓ Transfer complete");
}

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
main().catch((e) => { console.error("\nFATAL:", e); process.exit(1); });