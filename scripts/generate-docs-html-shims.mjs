#!/usr/bin/env node
/**
 * Creates VitePress markdown shims for static HTML under docs/public/.
 * Without these, cleanUrls client-side navigations 404 even when the HTML exists.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "docs/public");
const DOCS_DIR = join(ROOT, "docs");

/**
 * Lists every .html file under docs/public.
 */
function listHtmlFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      listHtmlFiles(full, acc);
      continue;
    }

    if (entry.name.endsWith(".html")) {
      acc.push(full);
    }
  }

  return acc;
}

/**
 * Builds a fullscreen iframe shim page for a public HTML file.
 */
function shimContents(htmlUrl, title) {
  return `---
title: ${JSON.stringify(title)}
layout: false
htmlShim: true
---

<iframe
  src=${JSON.stringify(htmlUrl)}
  title=${JSON.stringify(title)}
  style="position: fixed; inset: 0; width: 100%; height: 100%; border: 0; background: #fcfff7"
></iframe>
`;
}

const htmlFiles = listHtmlFiles(PUBLIC_DIR);
let created = 0;
let skipped = 0;

for (const htmlPath of htmlFiles) {
  const rel = relative(PUBLIC_DIR, htmlPath).split(sep).join("/");
  const routePath = rel.replace(/\.html$/, "");
  const mdPath = join(DOCS_DIR, `${routePath}.md`);
  const htmlUrl = `/${rel}`;
  const title = routePath.split("/").at(-1) ?? routePath;

  if (existsSync(mdPath)) {
    skipped += 1;
    continue;
  }

  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, shimContents(htmlUrl, title));
  created += 1;
  console.log(`created ${relative(ROOT, mdPath)}`);
}

console.log(`html shims: ${created} created, ${skipped} already present`);
