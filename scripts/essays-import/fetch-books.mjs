// Dump DB books (id, isbn_13, title, author) to /tmp/books_db.json for matching.
import { readFileSync, writeFileSync } from "node:fs";

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

const books = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from("books")
    .select("id, isbn_13, title, author")
    .range(from, from + 999);
  if (error) throw error;
  books.push(...data);
  if (data.length < 1000) break;
}
writeFileSync("/tmp/books_db.json", JSON.stringify(books));
console.log("DB books written:", books.length);
