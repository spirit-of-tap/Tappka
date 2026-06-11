// Backfill page_count and preview_link onto existing books, keyed by
// external_id (= Books.csv ID). Non-destructive: updates rows in place.
import { readFileSync } from "node:fs";

function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}
const env = loadEnv(process.cwd() + "/.env.local");
const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Reuse the same quoted/multiline CSV parser semantics as books-load.mjs.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const csv = parseCsv(readFileSync(process.cwd() + "/data/Books.csv", "utf8"));
const byId = new Map();
for (const r of csv) {
  const id = (r.ID || "").trim();
  if (!id) continue;
  const rawPages = (r.gb_pageCount || "").trim();
  const rawPreview = (r.gb_previewLink || r.gb_infoLink || "").trim();
  byId.set(id, {
    page_count: /^\d+$/.test(rawPages) ? parseInt(rawPages, 10) : null,
    preview_link: rawPreview ? rawPreview.replace("http://", "https://") : null,
  });
}

const { data: books, error } = await supabase.from("books").select("id, external_id");
if (error) throw error;

let updated = 0, pages = 0, previews = 0, noMatch = 0;
for (const b of books) {
  const src = b.external_id ? byId.get(b.external_id) : null;
  if (!src) { noMatch++; continue; }
  const { error: uErr } = await supabase
    .from("books")
    .update({ page_count: src.page_count, preview_link: src.preview_link })
    .eq("id", b.id);
  if (uErr) { console.error(`update ${b.id} failed:`, uErr.message); process.exit(1); }
  updated++;
  if (src.page_count != null) pages++;
  if (src.preview_link != null) previews++;
  process.stdout.write(`\rupdated ${updated}/${books.length}`);
}
console.log(`\nDONE. updated ${updated} books (page_count set: ${pages}, preview_link set: ${previews}, no CSV match: ${noMatch}).`);
