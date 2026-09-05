#!/usr/bin/env node
/**
 * Creates VitePress markdown shims for static HTML under docs/public/.
 * Without these, cleanUrls client-side navigations 404 even when the HTML exists.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, "docs/public");
const DOCS_DIR = join(ROOT, "docs");
const GENERATED_SHIM_MARKER = "htmlShim: true";
const THEME_STYLESHEET = "wiki-theme.css";
const WIKI_STATIC_PREFIX = "wiki-static/";

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

<HtmlShim src=${JSON.stringify(htmlUrl)} title=${JSON.stringify(title)} />
`;
}

function pageTitle(contents, fallback) {
  const match = contents.match(/<title>(.*?)<\/title>/is);
  return match?.[1]?.replace(/<[^>]*>/g, "").trim() ?? fallback;
}

function usesWikiTheme(relativePath) {
  return relativePath.startsWith(WIKI_STATIC_PREFIX);
}

function routeFor(relativePath) {
  const routePath = relativePath.replace(/\.html$/, "");

  if (!routePath.startsWith(WIKI_STATIC_PREFIX)) {
    return routePath;
  }

  const staticRoute = routePath.slice(WIKI_STATIC_PREFIX.length);
  return staticRoute.startsWith("wiki/")
    ? staticRoute
    : (staticRoute.split("/").at(-1) ?? staticRoute);
}

function normalizeStaticLinks(contents) {
  return contents.replace(/\bhref=(["'])([^"']+)\1/gi, (match, quote, href) => {
    if (!href || /^(?:[a-z]+:|\/|#)/i.test(href)) {
      return match;
    }

    const hashIndex = href.indexOf("#");
    const pathname = hashIndex === -1 ? href : href.slice(0, hashIndex);
    const hash = hashIndex === -1 ? "" : href.slice(hashIndex);

    if (!pathname || /\.[a-z0-9]+$/i.test(pathname) || pathname.endsWith("/")) {
      return match;
    }

    return `href=${quote}${pathname}.html${hash}${quote}`;
  });
}

function ensureWikiTheme(htmlPath, relativePath, contents) {
  if (!usesWikiTheme(relativePath)) {
    return contents;
  }

  let themedContents = normalizeStaticLinks(contents);

  if (!themedContents.includes(THEME_STYLESHEET)) {
    const directoryDepth = relativePath.split("/").length - 1;
    const stylesheetPath = `${"../".repeat(directoryDepth)}${THEME_STYLESHEET}`;
    const stylesheet = `<link rel="stylesheet" href="${stylesheetPath}">`;
    themedContents = themedContents.replace("</head>", `${stylesheet}\n</head>`);
  }

  if (themedContents !== contents) {
    writeFileSync(htmlPath, themedContents);
  }

  return themedContents;
}

const htmlFiles = listHtmlFiles(PUBLIC_DIR);
let created = 0;
let updated = 0;
let skipped = 0;

for (const htmlPath of htmlFiles) {
  const rel = relative(PUBLIC_DIR, htmlPath).split(sep).join("/");
  const routePath = routeFor(rel);
  const mdPath = join(DOCS_DIR, `${routePath}.md`);
  const htmlUrl = `/${rel}`;
  const fallbackTitle = routePath.split("/").at(-1) ?? routePath;
  const htmlContents = ensureWikiTheme(htmlPath, rel, readFileSync(htmlPath, "utf8"));
  const title = pageTitle(htmlContents, fallbackTitle);

  if (existsSync(mdPath)) {
    const markdown = readFileSync(mdPath, "utf8");

    if (!markdown.includes(GENERATED_SHIM_MARKER) || !usesWikiTheme(rel)) {
      skipped += 1;
      continue;
    }

    writeFileSync(mdPath, shimContents(htmlUrl, title));
    updated += 1;
    continue;
  }

  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, shimContents(htmlUrl, title));
  created += 1;
  console.log(`created ${relative(ROOT, mdPath)}`);
}

console.log(`html shims: ${created} created, ${updated} updated, ${skipped} preserved`);
