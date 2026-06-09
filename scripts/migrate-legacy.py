#!/usr/bin/env python3
"""
Legacy data migration: imports books and essays from SharePoint CSV exports.

Usage:
    python3 scripts/migrate-legacy.py [--dry-run]
"""

import csv
import json
import re
import sys
import argparse
import urllib.request
import urllib.error
from html.parser import HTMLParser

SUPABASE_URL = "http://127.0.0.1:54321"
SUPABASE_KEY = (
    "eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA5MTk3OTA0MX0"
    ".1TZszmxyBvP32ShyinCwR17NASNB_uZgo8gNSJGtDP2mkt2wGWdyWSLdObjOD0J6lYIV3ArPXL6CqIXmmEuLqg"
)

BOOKS_CSV  = "data/Books.csv"
ESSAYS_CSV = "data/Essays (1).csv"

# CategoryID → tag slug mapping
CATEGORY_MAP: dict[str, str] = {
    "4":  "podnikani",
    "5":  "managment",
    "6":  "Finance",
    "7":  "vedeni",
    "8":  "duchovni_rust",
    "9":  "uceni",
    "10": "spolecnost",
    "11": "inovace",
    "12": "Leadership",
    "13": "marketing",
    "15": "Finance",
    "16": "podnikani",
    "17": "vedeni",
    "18": "koucovani",
    "19": "Finance",
}

# SharePoint status string → DB enum value
STATUS_MAP: dict[str, str] = {
    "schváleno":            "approved",
    "schvaleno":            "approved",
    "zamítnuto":            "rejected",
    "zamitnuto":            "rejected",
    "čeká na schválení":    "pending",
    "ceka na schvaleni":    "pending",
    "":                     "pending",
}


# ── Supabase helpers ──────────────────────────────────────────────────────────

def _headers() -> dict:
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

def sb_get(table: str, query: str = "") -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    req = urllib.request.Request(url, headers=_headers())
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def sb_post(table: str, data: dict, dry_run: bool = False) -> dict | None:
    if dry_run:
        return {"id": "dry-run"}
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=_headers(), method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            rows = json.loads(r.read())
            return rows[0] if rows else None
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        # Unique constraint violation → already exists, skip silently
        if '"23505"' in msg or "duplicate" in msg.lower():
            return None
        print(f"  ERROR inserting into {table}: {msg[:200]}", file=sys.stderr)
        return None


# ── HTML → Tiptap JSON ────────────────────────────────────────────────────────

class TiptapConverter(HTMLParser):
    """Converts a subset of HTML to Tiptap-compatible JSON."""

    BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "br"}
    MARK_TAGS  = {"strong", "b", "em", "i", "u", "s", "strike", "code"}

    def __init__(self):
        super().__init__()
        self.doc: list = []          # top-level nodes
        self._stack: list = []       # current open block nodes
        self._marks: list[dict] = [] # active marks
        self._list_stack: list[str] = []

    def _current(self) -> list:
        return self._stack[-1]["content"] if self._stack else self.doc

    def _push_block(self, node: dict):
        self._current().append(node)
        self._stack.append(node)

    def _pop_block(self):
        if self._stack:
            self._stack.pop()

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ("h1", "h2", "h3", "h4"):
            level = int(tag[1])
            self._push_block({"type": "heading", "attrs": {"level": level}, "content": []})
        elif tag == "p":
            self._push_block({"type": "paragraph", "content": []})
        elif tag in ("div",):
            pass  # transparent
        elif tag == "blockquote":
            self._push_block({"type": "blockquote", "content": []})
        elif tag == "ul":
            self._list_stack.append("bulletList")
            self._push_block({"type": "bulletList", "content": []})
        elif tag == "ol":
            self._list_stack.append("orderedList")
            self._push_block({"type": "orderedList", "content": []})
        elif tag == "li":
            item = {"type": "listItem", "content": [{"type": "paragraph", "content": []}]}
            self._current().append(item)
            self._stack.append(item["content"][0])  # push inner paragraph
        elif tag == "br":
            self._current().append({"type": "hardBreak"})
        elif tag in ("strong", "b"):
            self._marks.append({"type": "bold"})
        elif tag in ("em", "i"):
            self._marks.append({"type": "italic"})
        elif tag == "u":
            self._marks.append({"type": "underline"})
        elif tag in ("s", "strike"):
            self._marks.append({"type": "strike"})
        elif tag == "code":
            self._marks.append({"type": "code"})
        elif tag == "img":
            pass  # skip images

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("h1", "h2", "h3", "h4", "p", "blockquote", "ul", "ol"):
            self._pop_block()
            if tag in ("ul", "ol") and self._list_stack:
                self._list_stack.pop()
        elif tag == "li":
            self._pop_block()
        elif tag in ("strong", "b", "em", "i", "u", "s", "strike", "code"):
            mark_type = {"strong": "bold", "b": "bold", "em": "italic", "i": "italic",
                         "u": "underline", "s": "strike", "strike": "strike", "code": "code"}.get(tag)
            self._marks = [m for m in self._marks if m["type"] != mark_type]

    def handle_data(self, data):
        text = data.replace(" ", " ")
        if not text.strip() and not text:
            return
        node: dict = {"type": "text", "text": text}
        if self._marks:
            node["marks"] = list(self._marks)
        # Ensure we're inside a block; if not, wrap in paragraph
        if not self._stack:
            para = {"type": "paragraph", "content": [node]}
            self.doc.append(para)
        else:
            self._current().append(node)

    def result(self) -> dict:
        content = [n for n in self.doc if n.get("content") or n["type"] == "hardBreak"]
        if not content:
            content = [{"type": "paragraph", "content": []}]
        return {"type": "doc", "content": content}


def html_to_tiptap(html: str) -> tuple[dict, str]:
    """Returns (tiptap_json, plain_text)."""
    if not html or not html.strip():
        return {"type": "doc", "content": [{"type": "paragraph", "content": []}]}, ""
    converter = TiptapConverter()
    converter.feed(html)
    doc = converter.result()
    plain = extract_text(doc)
    return doc, plain

def parse_date(raw: str) -> str | None:
    """Converts DD.MM.YYYY HH:MM or ISO 8601 strings to ISO 8601."""
    if not raw or not raw.strip():
        return None
    raw = raw.strip()
    # Already ISO format (e.g. from Essays CSV: 2024-07-30T00:00:00Z)
    if raw[0].isdigit() and "-" in raw:
        return raw
    # DD.MM.YYYY HH:MM
    try:
        from datetime import datetime
        dt = datetime.strptime(raw, "%d.%m.%Y %H:%M")
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        pass
    # DD.MM.YYYY
    try:
        from datetime import datetime
        dt = datetime.strptime(raw, "%d.%m.%Y")
        return dt.strftime("%Y-%m-%dT00:00:00Z")
    except ValueError:
        return None


def extract_text(node: dict) -> str:
    parts = []
    if node.get("type") == "text":
        parts.append(node.get("text", ""))
    for child in node.get("content", []):
        parts.append(extract_text(child))
    return " ".join(p for p in parts if p.strip())


# ── CSV parsing ───────────────────────────────────────────────────────────────

def read_csv(path: str) -> list[dict]:
    """Reads a SharePoint CSV export (row 0 = schema XML, row 1 = headers)."""
    with open(path, encoding="utf-8-sig") as f:
        lines = f.readlines()
    # Books.csv has a plain header on row 0 (no schema XML preamble);
    # Essays CSV has schema XML on row 0 and headers on row 1.
    # Detect by checking if row 0 starts with "ListSchema"
    if lines and lines[0].strip().startswith("ListSchema"):
        reader = csv.DictReader(lines[1:])
    else:
        reader = csv.DictReader(lines)
    return list(reader)


# ── Main migration ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Parse and print without inserting")
    args = parser.parse_args()
    dry = args.dry_run

    if dry:
        print("DRY RUN — nothing will be written to the database.\n")

    # Load all existing profiles keyed by work_email (lowercase)
    print("Loading profiles...")
    profiles_raw = sb_get("profiles", "select=id,work_email,role")
    profiles: dict[str, str] = {p["work_email"].lower(): p["id"] for p in profiles_raw}
    # Fallback: first coach or admin profile
    fallback_profile_id = next(
        (p["id"] for p in profiles_raw if p["role"] in ("coach", "admin")), None
    )
    if not fallback_profile_id and profiles_raw:
        fallback_profile_id = profiles_raw[0]["id"]
    print(f"  Found {len(profiles)} profiles. Fallback: {fallback_profile_id}")

    # ── BOOKS ─────────────────────────────────────────────────────────────────
    print("\nImporting books...")
    book_rows = read_csv(BOOKS_CSV)
    legacy_id_to_book_id: dict[str, str] = {}
    books_ok = books_skip = books_err = 0

    for row in book_rows:
        legacy_id = row.get("ID", "").strip()

        # Skip AI-flagged removals
        if row.get("ai_remove_flag", "").strip().lower() == "yes":
            books_skip += 1
            continue

        # Prefer Google Books title, fall back to SharePoint title
        title = (row.get("gb_title") or row.get("Title") or "").strip()
        if not title:
            books_skip += 1
            continue

        author = (row.get("gb_authors") or "Neznámý autor").strip() or "Neznámý autor"

        raw_isbn = row.get("gb_isbn_13", "").strip()
        isbn_13 = raw_isbn if raw_isbn else None

        description = (row.get("gb_description") or row.get("ShortDescrition") or "").strip() or None

        raw_status = row.get("status", "").strip()
        db_status = STATUS_MAP.get(raw_status.lower(), "pending")

        raw_points = row.get("ai_points", "").strip()
        points = int(raw_points) if raw_points.isdigit() else 1
        points = max(1, min(3, points))
        # Only set book_points for approved books; pending/rejected stay at 0
        book_points = points if db_status == "approved" else 0

        cat_id = row.get("CategoryID", "").strip()
        tags = []
        if cat_id in CATEGORY_MAP:
            tags.append(CATEGORY_MAP[cat_id])
        thematic = row.get("ai_thematic_area", "").strip()
        if thematic and thematic not in tags:
            tags.append(thematic)

        # No per-book email in this CSV; use fallback profile
        profile_id = fallback_profile_id
        if not profile_id:
            print(f"  SKIP book '{title}': no fallback profile available")
            books_skip += 1
            continue

        created_at = parse_date(row.get("Created", ""))

        source = "google_books" if isbn_13 else "manual"

        # Prefer larger thumbnail; force HTTPS so Next.js Image accepts it
        raw_cover = (row.get("gb_img_thumbnail") or row.get("gb_img_smallThumbnail") or "").strip()
        cover_path = raw_cover.replace("http://", "https://") if raw_cover else None

        book_data: dict = {
            "title":                  title,
            "author":                 author,
            "isbn_13":                isbn_13,
            "description":            description,
            "tags":                   tags,
            "cover_path":             cover_path,
            "suggested_points":       points,
            "book_points":            book_points,
            "status":                 db_status,
            "source":                 source,
            "added_by_profile_id":    profile_id,
        }

        if db_status == "approved":
            book_data["approved_by_profile_id"] = profile_id
            book_data["approved_at"] = created_at or "2024-09-14T00:00:00Z"

        if db_status == "rejected":
            book_data["rejection_reason"] = row.get("ReasonForDeny", "").strip() or None

        if created_at:
            book_data["created_at"] = created_at

        result = sb_post("books", book_data, dry_run=dry)
        if result and result.get("id") and result["id"] != "dry-run":
            legacy_id_to_book_id[legacy_id] = result["id"]
            books_ok += 1
        elif result and result.get("id") == "dry-run":
            legacy_id_to_book_id[legacy_id] = f"dry-{legacy_id}"
            books_ok += 1
        else:
            books_err += 1

    print(f"  Books: {books_ok} inserted, {books_skip} skipped, {books_err} errors")

    # ── ESSAYS ────────────────────────────────────────────────────────────────
    print("\nImporting essays...")
    essays = read_csv(ESSAYS_CSV)
    essays_ok = essays_skip = essays_err = 0

    for row in essays:
        author_email = row.get("AutorEditable", "").strip().lower()
        title        = row.get("Nadpis", "").strip()
        legacy_src   = row.get("SourceID", "").strip()
        deactivated  = row.get("Deactivate", "").strip().lower()
        html_body    = row.get("MainText", "").strip()
        created_at   = parse_date(row.get("VytvořenoEditable", ""))

        if not title or deactivated == "pravda":
            essays_skip += 1
            continue

        profile_id = profiles.get(author_email)
        if not profile_id:
            essays_skip += 1
            continue

        book_id = legacy_id_to_book_id.get(legacy_src) if legacy_src else None
        if book_id and book_id.startswith("dry-"):
            book_id = None

        content_json, content_text = html_to_tiptap(html_body)

        essay_data = {
            "title":             title,
            "content_json":      content_json,
            "content_text":      content_text[:10000],
            "author_profile_id": profile_id,
            "book_id":           book_id,
            "published":         True,
        }
        if created_at:
            essay_data["created_at"] = created_at

        result = sb_post("essays", essay_data, dry_run=dry)
        if result:
            essays_ok += 1
        else:
            essays_err += 1

    print(f"  Essays: {essays_ok} inserted, {essays_skip} skipped, {essays_err} errors")
    print("\nDone.")


if __name__ == "__main__":
    main()
