// Recompute book status + book_points from Books.csv, keyed by external_id.
// Non-destructive UPDATE. Fixes books whose legacy `status` was blank but were
// actually approved (BoB=True) and had been demoted to pending with 0 points.
//
// Approval rule:
//   status 'Schváleno'        -> approved
//   status 'Zamítnuto'        -> rejected
//   status 'Čeká na schválení'-> pending
//   blank status              -> approved if BoB=True else pending
// book_points (approved only) = clamp(ai_points, 1..3); matches suggested_points.
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

function statusOf(r) {
  // BoB=True (Book-of-Books) is authoritative approval; it overrides a stale
  // explicit status (some books are marked Zamítnuto/Čeká yet are BoB=True).
  if ((r.BoB || "").trim().toLowerCase() === "true") return "approved";
  const s = (r.status || "").trim().toLowerCase();
  if (s === "schváleno" || s === "schvaleno") return "approved";
  if (s === "zamítnuto" || s === "zamitnuto") return "rejected";
  return "pending"; // Čeká na schválení or blank
}
const clamp = (n) => Math.max(1, Math.min(3, n));
function pointsOf(r) {
  const raw = (r.ai_points || "").trim();
  return clamp(/^\d+$/.test(raw) ? parseInt(raw, 10) : 1);
}
function parseDate(raw) {
  raw = (raw || "").trim();
  const m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, h = "0", mi = "0"] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  return isNaN(dt) ? null : dt.toISOString();
}

const csv = parseCsv(readFileSync(process.cwd() + "/data/Books.csv", "utf8"));
const byId = new Map();
for (const r of csv) {
  const id = (r.ID || "").trim();
  if (id) byId.set(id, r);
}

const { data: profs } = await supabase.from("profiles").select("id, role").in("role", ["coach", "admin"]).limit(1);
const fallbackProfileId = profs?.[0]?.id;

const { data: books, error } = await supabase.from("books").select("id, external_id, status");
if (error) throw error;

const tally = { approved: 0, pending: 0, rejected: 0 };
let updated = 0, skippedApproved = 0;
for (const b of books) {
  const r = b.external_id ? byId.get(b.external_id) : null;
  if (!r) continue;
  // Already-approved books are immutable (protect_approved_book trigger) and
  // already correct — never demoted by this rule — so leave them untouched.
  if (b.status === "approved") { skippedApproved++; continue; }
  const status = statusOf(r);
  const points = pointsOf(r);
  const patch = {
    status,
    suggested_points: points,
    book_points: status === "approved" ? points : 0,
    approved_by_profile_id: status === "approved" ? fallbackProfileId : null,
    approved_at: status === "approved" ? (parseDate(r.Created) || "2024-09-14T00:00:00Z") : null,
    rejection_reason: status === "rejected" ? ((r.ReasonForDeny || "").trim() || null) : null,
  };
  const { error: uErr } = await supabase.from("books").update(patch).eq("id", b.id);
  if (uErr) { console.error(`update ${b.id} failed:`, uErr.message); process.exit(1); }
  tally[status]++;
  updated++;
  process.stdout.write(`\rupdated ${updated}/${books.length}`);
}
console.log(`\nDONE. updated ${updated} non-approved books (skipped ${skippedApproved} already-approved). new among updated: approved=${tally.approved} pending=${tally.pending} rejected=${tally.rejected}`);
