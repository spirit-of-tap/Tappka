// Convert legacy essay HTML to Tiptap JSON and bulk-insert into public.essays
// via supabase-js using the LOCAL service-role key. Run after the alumni
// profiles are created and the essays table has been emptied.
//
// Reads: /tmp/essays.ndjson, /tmp/author_map.json
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(process.cwd() + "/x.js");

// --- env (local Supabase) ----------------------------------------------------
function loadEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}
const env = loadEnv(process.cwd() + "/.env.local");
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing local Supabase env");

// --- DOM shim so @tiptap/html can parse HTML in Node ------------------------
const HD = process.cwd() + "/node_modules/.pnpm/happy-dom@20.9.0/node_modules/happy-dom/lib/index.js";
const { Window } = require(HD);
const win = new Window({ url: "http://localhost" });
globalThis.window = win;
globalThis.document = win.document;
globalThis.DOMParser = win.DOMParser;
globalThis.Node = win.Node;

const origWarn = console.warn;
console.warn = () => {}; // silence tiptap duplicate-extension notices

function makeDom() {
  const w = new Window({ url: "http://localhost" });
  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.DOMParser = w.DOMParser;
  globalThis.Node = w.Node;
  return w;
}

const { generateJSON } = await import("@tiptap/html");
const StarterKit = (await import("@tiptap/starter-kit")).default;
const Highlight = (await import("@tiptap/extension-highlight")).default;
const Underline = (await import("@tiptap/extension-underline")).default;
const Link = (await import("@tiptap/extension-link")).default;
const TextAlign = (await import("@tiptap/extension-text-align")).default;
const Typography = (await import("@tiptap/extension-typography")).default;
const Image = (await import("@tiptap/extension-image")).default;
const { createClient } = await import("@supabase/supabase-js");

// Mirror components/essays/tiptap-renderer.tsx so stored JSON round-trips.
const EXTENSIONS = [
  StarterKit,
  Highlight.configure({ multicolor: true }),
  Underline,
  Link.configure({ HTMLAttributes: { rel: "noopener noreferrer" } }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Typography,
  Image,
];

const BLOCK = new Set([
  "paragraph", "heading", "blockquote", "listItem", "codeBlock",
  "bulletList", "orderedList", "horizontalRule",
]);

function plainText(node, out) {
  if (!node) return;
  if (node.type === "text" && node.text) out.parts.push(node.text);
  if (node.type === "hardBreak") out.parts.push("\n");
  if (Array.isArray(node.content)) for (const c of node.content) plainText(c, out);
  if (BLOCK.has(node.type)) out.parts.push("\n");
}

function toContentText(doc) {
  const out = { parts: [] };
  plainText(doc, out);
  return out.parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

// --- load inputs -------------------------------------------------------------
const authorMap = JSON.parse(readFileSync("/tmp/author_map.json", "utf8"));
const lines = readFileSync("/tmp/essays.ndjson", "utf8").split("\n").filter(Boolean);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Book link: essay.source_id == books.external_id (== legacy Books.csv ID).
const bookByExternalId = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("books").select("id, external_id").range(from, from + 999);
  if (error) throw error;
  for (const b of data) if (b.external_id) bookByExternalId.set(b.external_id, b.id);
  if (data.length < 1000) break;
}
console.log(`book external_id map: ${bookByExternalId.size} entries`);
let linked = 0;
let unlinkedSource = 0;

// Convert + insert one batch at a time so we never hold all JSON in memory.
// A fresh happy-dom Window per batch avoids DOM accumulation across 6.5k parses.
const BATCH = 250;
let inserted = 0;
let skipped = 0;

for (let i = 0; i < lines.length; i += BATCH) {
  makeDom();
  const batch = [];
  for (const line of lines.slice(i, i + BATCH)) {
    const r = JSON.parse(line);
    const author_profile_id = authorMap[r.label];
    if (!author_profile_id) { skipped++; continue; }
    let content_json;
    try {
      content_json = generateJSON(r.html, EXTENSIONS);
    } catch {
      skipped++;
      continue;
    }
    const book_id = r.source_id ? bookByExternalId.get(r.source_id) ?? null : null;
    if (r.source_id) { if (book_id) linked++; else unlinkedSource++; }
    batch.push({
      author_profile_id,
      book_id,
      title: r.title,
      content_json,
      content_text: toContentText(content_json),
      published: true,
      created_at: r.created ?? undefined,
      updated_at: r.created ?? undefined,
    });
  }
  if (batch.length) {
    const { error } = await supabase.from("essays").insert(batch);
    if (error) {
      console.warn = origWarn;
      console.error(`\nBatch at ${i} failed:`, error.message, error.details ?? "");
      process.exit(1);
    }
    inserted += batch.length;
  }
  process.stdout.write(`\rinserted ${inserted} (skipped ${skipped})`);
}

console.warn = origWarn;
console.log(`\nDONE. inserted ${inserted} essays (skipped ${skipped}).`);
console.log(`book_id linked: ${linked}  |  source_id with no matching book: ${unlinkedSource}`);
