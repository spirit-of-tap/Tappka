// Resolve every legacy author label to a profile id.
// Matched -> existing profile (accent/order-insensitive token-set match).
// Unmatched -> a freshly generated "alumni" profile (role=student, no login).
//
// Reads:  /tmp/profiles.json (existing profiles), /tmp/author_labels.json
// Writes: /tmp/author_map.json   {rawLabel: profileId}
//         /tmp/alumni.json       [{id,name,work_email}]
//         /tmp/alumni_insert.sql multi-row INSERT for the Supabase MCP
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const tokenKey = (s) =>
  s
    .split("(")[0]
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/,/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");

const slug = (name) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

const sqlStr = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const profiles = JSON.parse(readFileSync("/tmp/profiles.json", "utf8"));
const labels = JSON.parse(readFileSync("/tmp/author_labels.json", "utf8"));

const byKey = new Map();
for (const p of profiles) {
  const k = tokenKey(p.name);
  if (!byKey.has(k)) byKey.set(k, p);
}

const authorMap = {};
const alumni = [];
let matched = 0;

for (const [label, info] of Object.entries(labels)) {
  const hit = byKey.get(info.key);
  if (hit) {
    authorMap[label] = hit.id;
    matched++;
  } else {
    const id = randomUUID();
    // work_email must satisfy the valid_czu_domain check constraint.
    const email = `alumni.${alumni.length + 1}.${slug(info.name) || "x"}@studenti.czu.cz`;
    alumni.push({ id, name: info.name, work_email: email });
    authorMap[label] = id;
  }
}

writeFileSync("/tmp/author_map.json", JSON.stringify(authorMap));
writeFileSync("/tmp/alumni.json", JSON.stringify(alumni, null, 2));

const values = alumni
  .map((a) => `  (${sqlStr(a.id)}, ${sqlStr(a.name)}, ${sqlStr(a.work_email)}, 'student')`)
  .join(",\n");
const sql = alumni.length
  ? `insert into public.profiles (id, name, work_email, role) values\n${values};\n`
  : "-- no alumni to insert\n";
writeFileSync("/tmp/alumni_insert.sql", sql);

console.log(`labels: ${Object.keys(labels).length}`);
console.log(`matched to existing profiles: ${matched}`);
console.log(`alumni profiles to create:    ${alumni.length}`);
console.log("sample alumni:", alumni.slice(0, 5).map((a) => `${a.name} <${a.work_email}>`));
