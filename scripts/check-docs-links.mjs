#!/usr/bin/env node
/**
 * Crawls the VitePress docs site and reports broken local links.
 *
 * Usage: node scripts/check-docs-links.mjs [baseUrl]
 * Default baseUrl: http://localhost:5173
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const BASE = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const DOCS_ROOT = join(process.cwd(), "docs");
const PUBLIC_DIR = join(DOCS_ROOT, "public");

const EXTERNAL = /^(https?:|mailto:|tel:|data:|javascript:)/i;
const SKIP_PATH = /^\/(@|__|node_modules)/;

/**
 * Lists markdown routes served by VitePress.
 */
function markdownRoutes() {
  const routes = new Set(["/"]);

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name === ".vitepress" ||
        entry.name === "public" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }

      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (!entry.name.endsWith(".md")) {
        continue;
      }

      const rel = relative(DOCS_ROOT, full).split(sep).join("/");

      if (rel === "index.md") {
        routes.add("/");
        continue;
      }

      routes.add(`/${rel.replace(/\.md$/, "")}`);
    }
  };

  walk(DOCS_ROOT);

  return routes;
}

/**
 * Lists static public files as URL pathnames (with and without .html).
 */
function publicRoutes() {
  const routes = new Set();

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      const rel = relative(PUBLIC_DIR, full).split(sep).join("/");
      routes.add(`/${rel}`);

      if (rel.endsWith(".html")) {
        routes.add(`/${rel.slice(0, -".html".length)}`);
      }
    }
  };

  if (existsSync(PUBLIC_DIR)) {
    walk(PUBLIC_DIR);
  }

  return routes;
}

/**
 * Resolves a href from a page URL into an absolute site pathname.
 */
function resolveHref(fromPath, href) {
  if (!href || href.startsWith("#") || EXTERNAL.test(href)) {
    return null;
  }

  const trimmed = href.split("#")[0].split("?")[0];

  if (!trimmed) {
    return null;
  }

  let pathname;

  if (trimmed.startsWith("/")) {
    pathname = trimmed;
  } else {
    const baseDir = fromPath.endsWith("/")
      ? fromPath
      : fromPath.replace(/\/[^/]*$/, "/");
    pathname = new URL(trimmed, `http://local${baseDir}`).pathname;
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // keep encoded form
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return pathname;
}

/**
 * Strips fenced code blocks so sample app routes are not treated as docs links.
 */
function stripCodeFences(content) {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/~~~[\s\S]*?~~~/g, "");
}

/**
 * Extracts href/src targets from HTML or markdown.
 */
function extractLinks(content, isMarkdown) {
  const links = new Set();
  const source = isMarkdown ? stripCodeFences(content) : content;

  for (const match of source.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)) {
    links.add(match[1]);
  }

  for (const match of source.matchAll(/\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    links.add(match[1]);
  }

  if (isMarkdown) {
    for (const match of source.matchAll(/\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      links.add(match[1]);
    }

    for (const match of source.matchAll(/link:\s*(\/[^\s]+)/g)) {
      links.add(match[1]);
    }
  }

  return [...links];
}

/**
 * Fetches a URL and returns status + body text (binary-safe for PDFs).
 */
async function fetchPage(pathname) {
  const res = await fetch(`${BASE}${pathname}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const isBinary = pathname.endsWith(".pdf") || buf.slice(0, 4).toString() === "%PDF";
  const text = isBinary ? "" : buf.toString("utf8");

  return { status: res.status, text, len: buf.length, isBinary };
}

/**
 * True when the response is VitePress SPA shell without a real static file.
 */
function isSpaShell(text, len) {
  return len < 2000 && text.includes("@vite/client") && text.includes('id="app"');
}

/**
 * True when a pathname is a known local docs target.
 */
function isKnownRoute(pathname, mdRoutes, pubRoutes) {
  if (mdRoutes.has(pathname) || pubRoutes.has(pathname)) {
    return true;
  }

  if (pubRoutes.has(`${pathname}.html`)) {
    return true;
  }

  if (pathname.endsWith(".html") && pubRoutes.has(pathname.slice(0, -5))) {
    return true;
  }

  return false;
}

async function main() {
  if (!existsSync(DOCS_ROOT)) {
    console.error("docs/ not found — run from repo root");
    process.exit(1);
  }

  const mdRoutes = markdownRoutes();
  const pubRoutes = publicRoutes();
  const seed = [...mdRoutes, ...[...pubRoutes].filter((p) => !p.endsWith(".pdf"))];

  /** @type {Map<string, { status: number, text: string, len: number, isBinary: boolean }>} */
  const fetched = new Map();
  /** @type {{ from: string, href: string, resolved: string, reason: string }[]} */
  const failures = [];
  /** @type {Set<string>} */
  const checked = new Set();

  console.log(`Checking docs links against ${BASE}`);
  console.log(`Seeds: ${seed.length} routes (${mdRoutes.size} md, ${pubRoutes.size} public aliases)\n`);

  for (const pathname of seed) {
    if (SKIP_PATH.test(pathname) || checked.has(pathname)) {
      continue;
    }

    checked.add(pathname);

    let page;

    try {
      page = await fetchPage(pathname);
      fetched.set(pathname, page);
    } catch (error) {
      failures.push({
        from: "(seed)",
        href: pathname,
        resolved: pathname,
        reason: `fetch failed: ${error instanceof Error ? error.message : error}`,
      });
      continue;
    }

    // Markdown routes intentionally return the VitePress SPA shell.
    // Only require raw static bytes for public assets that have no .md page.
    const expectsStatic =
      !mdRoutes.has(pathname) &&
      (pubRoutes.has(pathname) ||
        pubRoutes.has(`${pathname}.html`) ||
        pathname.endsWith(".html") ||
        pathname.endsWith(".pdf"));

    if (page.status !== 200) {
      failures.push({
        from: "(seed)",
        href: pathname,
        resolved: pathname,
        reason: `HTTP ${page.status}`,
      });
      continue;
    }

    if (expectsStatic && isSpaShell(page.text, page.len)) {
      failures.push({
        from: "(seed)",
        href: pathname,
        resolved: pathname,
        reason: "expected static file, got VitePress SPA shell",
      });
      continue;
    }

    if (page.isBinary) {
      continue;
    }

    // Prefer source files for link extraction (SPA shell has no content links)
    let content = page.text;
    let isMarkdown = false;

    if (isSpaShell(page.text, page.len) || mdRoutes.has(pathname)) {
      const mdPath =
        pathname === "/"
          ? join(DOCS_ROOT, "index.md")
          : join(DOCS_ROOT, `${pathname.slice(1)}.md`);

      if (existsSync(mdPath)) {
        content = readFileSync(mdPath, "utf8");
        isMarkdown = true;
      }
    }

    const htmlPath = pathname.endsWith(".html")
      ? join(PUBLIC_DIR, pathname.slice(1))
      : join(PUBLIC_DIR, `${pathname.slice(1)}.html`);

    if (!isMarkdown && existsSync(htmlPath)) {
      content = readFileSync(htmlPath, "utf8");
    }

    for (const href of extractLinks(content, isMarkdown)) {
      const resolved = resolveHref(pathname === "/" ? "/" : pathname, href);

      if (!resolved || SKIP_PATH.test(resolved)) {
        continue;
      }

      if (!isKnownRoute(resolved, mdRoutes, pubRoutes)) {
        // Allow directory-style public index: /wiki/index
        failures.push({
          from: pathname,
          href,
          resolved,
          reason: "no matching markdown or public file",
        });
        continue;
      }

      if (fetched.has(resolved) || checked.has(resolved)) {
        const prior = fetched.get(resolved);

        if (prior && prior.status !== 200) {
          failures.push({
            from: pathname,
            href,
            resolved,
            reason: `HTTP ${prior.status}`,
          });
        }

        continue;
      }

      checked.add(resolved);

      try {
        const target = await fetchPage(resolved);
        fetched.set(resolved, target);

        const targetStatic =
          !mdRoutes.has(resolved) &&
          (pubRoutes.has(resolved) ||
            pubRoutes.has(`${resolved}.html`) ||
            resolved.endsWith(".html") ||
            resolved.endsWith(".pdf"));

        if (target.status !== 200) {
          failures.push({
            from: pathname,
            href,
            resolved,
            reason: `HTTP ${target.status}`,
          });
        } else if (targetStatic && isSpaShell(target.text, target.len)) {
          failures.push({
            from: pathname,
            href,
            resolved,
            reason: "expected static file, got VitePress SPA shell",
          });
        }
      } catch (error) {
        failures.push({
          from: pathname,
          href,
          resolved,
          reason: `fetch failed: ${error instanceof Error ? error.message : error}`,
        });
      }
    }
  }

  // Also validate sidebar/nav links from config source
  const configPath = join(DOCS_ROOT, ".vitepress/config.ts");

  if (existsSync(configPath)) {
    const configText = readFileSync(configPath, "utf8");

    for (const match of configText.matchAll(/link:\s*["']([^"']+)["']/g)) {
      const href = match[1];
      const resolved = resolveHref("/", href);

      if (!resolved || EXTERNAL.test(href)) {
        continue;
      }

      if (!isKnownRoute(resolved, mdRoutes, pubRoutes)) {
        failures.push({
          from: "docs/.vitepress/config.ts",
          href,
          resolved,
          reason: "no matching markdown or public file",
        });
      }
    }
  }

  if (failures.length === 0) {
    console.log(`OK — checked ${checked.size} paths, 0 broken links`);
    process.exit(0);
  }

  console.error(`FAIL — ${failures.length} broken link(s):\n`);

  for (const failure of failures) {
    console.error(`- ${failure.resolved}`);
    console.error(`  from: ${failure.from}`);
    console.error(`  href: ${failure.href}`);
    console.error(`  reason: ${failure.reason}\n`);
  }

  process.exit(1);
}

main();
