// Backfill ai_book_points, legacy_book_points, ai_reason, and the effective
// book_points onto existing books, keyed by external_id (= Books.csv ID).
//
// Effective book_points (approved books only):
//   created_at >= 2026-07-01  -> ai_book_points
//   created_at <  2026-07-01  -> legacy_book_points (fallback ai if missing)
// Non-approved books keep book_points 0.
//
// The books_protect_approved_trigger must be disabled around this run (it
// blocks book_points changes on approved books).
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

const CUTOVER = Date.parse("2026-07-01T00:00:00Z"); // AI points from this date

function aiPointsOf(r) {
  const raw = (r.ai_points || "").trim();
  if (!/^\d+$/.test(raw)) return null;
  return Math.max(1, Math.min(3, parseInt(raw, 10)));
}
function legacyPointsOf(r) {
  const raw = (r.BookPoints || "").trim().replace(",", "."); // Czech decimal
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const csv = parseCsv(readFileSync(process.cwd() + "/data/Books.csv", "utf8"));
const byId = new Map();
for (const r of csv) {
  const id = (r.ID || "").trim();
  if (id) byId.set(id, r);
}

const { data: books, error } = await supabase.from("books").select("id, external_id, status, created_at");
if (error) throw error;

// Pass 1 (this script): always safe to set the three new columns. Also set the
// effective book_points for NON-approved books (no-op 0, trigger not involved).
// For APPROVED books, changing book_points is guarded by
// books_protect_approved_trigger, so we skip it here and report the pending
// rewrite count; it is applied separately once the trigger is handled.
let updated = 0, pendingApprovedRewrite = 0;
for (const b of books) {
  const r = b.external_id ? byId.get(b.external_id) : null;
  if (!r) continue;

  const ai = aiPointsOf(r);
  const legacy = legacyPointsOf(r);
  const reason = (r.ai_reason || "").trim() || null;

  const patch = { ai_book_points: ai, legacy_book_points: legacy, ai_reason: reason };

  if (b.status === "approved") {
    const useAi = Date.parse(b.created_at) >= CUTOVER;
    const effective = useAi ? (ai ?? legacy ?? 0) : (legacy ?? ai ?? 0);
    if (Number(b.book_points ?? 0) !== Number(effective)) pendingApprovedRewrite++;
    // book_points intentionally omitted (immutable-while-approved trigger).
  } else {
    patch.book_points = 0;
  }

  const { error: uErr } = await supabase.from("books").update(patch).eq("id", b.id);
  if (uErr) { console.error(`\nupdate ${b.id} failed:`, uErr.message); process.exit(1); }
  updated++;
  process.stdout.write(`\rupdated ${updated}/${books.length}`);
}
console.log(`\nDONE. updated ${updated} books (columns set). approved book_points still to rewrite: ${pendingApprovedRewrite}.`);
