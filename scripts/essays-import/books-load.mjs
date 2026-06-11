// Re-import books from data/Books.csv, storing external_id = Books.csv ID so
// essays can link by SourceID -> external_id (pure id, no name/ISBN matching).
// Deletes existing books first (cascades to team_reading_list_books,
// book_comments; nulls essays.book_id). Run before reloading essays.
//
// Mirrors the book field logic in scripts/migrate-legacy.py.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/x.js");

// --- env ---------------------------------------------------------------------
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

// --- maps (from migrate-legacy.py) -------------------------------------------
const CATEGORY_MAP = {
  "4": "podnikani", "5": "managment", "6": "Finance", "7": "vedeni",
  "8": "duchovni_rust", "9": "uceni", "10": "spolecnost", "11": "inovace",
  "12": "Leadership", "13": "marketing", "15": "Finance", "16": "podnikani",
  "17": "vedeni", "18": "koucovani", "19": "Finance",
};
const STATUS_MAP = {
  "schváleno": "approved", "schvaleno": "approved",
  "zamítnuto": "rejected", "zamitnuto": "rejected",
  "čeká na schválení": "pending", "ceka na schvaleni": "pending",
};
// BoB=True (Book-of-Books) is authoritative approval and overrides the legacy
// `status` word, which is sometimes stale (e.g. Zamítnuto/Čeká on BoB books).
// Without BoB, fall back to the status map; blank/Čeká default to pending.
function statusOf(r) {
  if ((r.BoB || "").trim().toLowerCase() === "true") return "approved";
  return STATUS_MAP[(r.status || "").trim().toLowerCase()] ?? "pending";
}

function parseDate(raw) {
  raw = (raw || "").trim();
  if (!raw) return null;
  // "14.09.2024 18:39" or "14.09.2024"
  const m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, h = "0", mi = "0"] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  return isNaN(dt) ? null : dt.toISOString();
}

// --- CSV parse (quoted, multiline) -------------------------------------------
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
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ""])));
}

// --- fallback profile (first coach/admin) ------------------------------------
const { data: profs, error: pErr } = await supabase
  .from("profiles").select("id, role").in("role", ["coach", "admin"]).limit(1);
if (pErr) throw pErr;
const fallbackProfileId = profs?.[0]?.id;
if (!fallbackProfileId) throw new Error("No coach/admin fallback profile found");
console.log("fallback profile:", fallbackProfileId);

// --- delete existing books ---------------------------------------------------
const { count: before } = await supabase.from("books").select("id", { count: "exact", head: true });
const { error: delErr } = await supabase.from("books").delete().not("id", "is", null);
if (delErr) throw delErr;
console.log(`deleted ${before ?? "?"} existing books`);

// --- build rows --------------------------------------------------------------
const csv = parseCsv(readFileSync(process.cwd() + "/data/Books.csv", "utf8"));
const clamp = (n) => Math.max(1, Math.min(3, n));
const rows = [];
let skipped = 0;
for (const r of csv) {
  const legacyId = (r.ID || "").trim();
  if ((r.ai_remove_flag || "").trim().toLowerCase() === "yes") { skipped++; continue; }
  const title = (r.gb_title || r.Title || "").trim();
  if (!title || !legacyId) { skipped++; continue; }

  const isbn13 = (r.gb_isbn_13 || "").trim() || null;
  const description = (r.gb_description || r.ShortDescrition || "").trim() || null;
  const dbStatus = statusOf(r);
  const rawPoints = (r.ai_points || "").trim();
  const points = clamp(/^\d+$/.test(rawPoints) ? parseInt(rawPoints, 10) : 1);
  const bookPoints = dbStatus === "approved" ? points : 0;

  const tags = [];
  const catId = (r.CategoryID || "").trim();
  if (CATEGORY_MAP[catId]) tags.push(CATEGORY_MAP[catId]);
  const thematic = (r.ai_thematic_area || "").trim();
  if (thematic && !tags.includes(thematic)) tags.push(thematic);

  const createdAt = parseDate(r.Created);
  const rawCover = (r.gb_img_thumbnail || r.gb_img_smallThumbnail || "").trim();
  const coverPath = rawCover ? rawCover.replace("http://", "https://") : null;

  const rawPages = (r.gb_pageCount || "").trim();
  const pageCount = /^\d+$/.test(rawPages) ? parseInt(rawPages, 10) : null;
  const rawPreview = (r.gb_previewLink || r.gb_infoLink || "").trim();
  const previewLink = rawPreview ? rawPreview.replace("http://", "https://") : null;

  const book = {
    external_id: legacyId,
    title,
    author: (r.gb_authors || "Neznámý autor").trim() || "Neznámý autor",
    isbn_13: isbn13,
    description,
    tags,
    cover_path: coverPath,
    page_count: pageCount,
    preview_link: previewLink,
    suggested_points: points,
    book_points: bookPoints,
    status: dbStatus,
    source: isbn13 ? "google_books" : "manual",
    added_by_profile_id: fallbackProfileId,
  };
  if (dbStatus === "approved") {
    book.approved_by_profile_id = fallbackProfileId;
    book.approved_at = createdAt || "2024-09-14T00:00:00Z";
  }
  if (dbStatus === "rejected") book.rejection_reason = (r.ReasonForDeny || "").trim() || null;
  if (createdAt) book.created_at = createdAt;
  rows.push(book);
}

// --- insert ------------------------------------------------------------------
const BATCH = 200;
let inserted = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const { error } = await supabase.from("books").insert(rows.slice(i, i + BATCH));
  if (error) { console.error(`Book batch at ${i} failed:`, error.message, error.details ?? ""); process.exit(1); }
  inserted += Math.min(BATCH, rows.length - i);
  process.stdout.write(`\rinserted ${inserted}/${rows.length} books`);
}
console.log(`\nDONE. books inserted ${inserted} (skipped ${skipped}).`);
