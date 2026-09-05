#!/usr/bin/env python3
"""Refresh local dev DB's books/essays/essay_revisions/book_tags/content_sources
from LIVE production (via REST API), for local testing/debugging.

Preserves profiles/teams (already a superset of prod's current profile IDs,
verified before running this) — only truncates+replaces the tables below.

Usage:
  python3 scripts/import-prod-live-to-local.py --dry-run
  python3 scripts/import-prod-live-to-local.py
"""
import argparse
import json
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

ROOT = Path(__file__).resolve().parent.parent
LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def fetch_all(url: str, headers: dict, table: str, select: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    step = 1000
    while True:
        r = requests.get(
            f"{url}/rest/v1/{table}",
            headers=headers,
            params={"select": select, "limit": step, "offset": offset},
            timeout=30,
        )
        r.raise_for_status()
        batch = r.json()
        rows.extend(batch)
        if len(batch) < step:
            break
        offset += step
    return rows


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    env = load_env(ROOT / ".env.transfer.local")
    url = env["PRODUCTION_SUPABASE_URL"]
    key = env["PRODUCTION_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    print("Fetching from production...")
    books = fetch_all(url, headers, "books", "*")
    essays = fetch_all(url, headers, "essays", "*")
    revisions = fetch_all(url, headers, "essay_revisions", "*")
    book_tags = fetch_all(url, headers, "book_tags", "*")
    content_sources = fetch_all(url, headers, "content_sources", "*")
    print(f"  books: {len(books)}")
    print(f"  essays: {len(essays)}")
    print(f"  essay_revisions: {len(revisions)}")
    print(f"  book_tags: {len(book_tags)}")
    print(f"  content_sources: {len(content_sources)}")

    if args.dry_run:
        print("Dry run, exiting.")
        return

    conn = psycopg2.connect(LOCAL_DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute("SET session_replication_role = 'replica';")

        print("Truncating local books/essays/essay_revisions/book_tags/content_sources/library_books/book_loans/essay_comments/essay_votes/essay_coach_reads/essay_views...")
        cur.execute("""
            TRUNCATE
                essay_revisions,
                essay_comments,
                essay_votes,
                essay_coach_reads,
                essay_views,
                essays,
                book_tags,
                library_books,
                book_loans,
                content_sources,
                books
            CASCADE;
        """)

        def adapt(v):
            if isinstance(v, (dict, list)):
                return psycopg2.extras.Json(v)
            return v

        def insert_rows(table: str, rows: list[dict]) -> None:
            if not rows:
                return
            cols = list(rows[0].keys())
            values = [tuple(adapt(r.get(c)) for c in cols) for r in rows]
            col_list = ", ".join(f'"{c}"' for c in cols)
            template = "(" + ", ".join(["%s"] * len(cols)) + ")"
            query = f'INSERT INTO public."{table}" ({col_list}) VALUES %s'
            for i in range(0, len(values), 500):
                batch = values[i : i + 500]
                psycopg2.extras.execute_values(cur, query, batch, template=template, page_size=500)
            print(f"  inserted {len(values)} rows into {table}")

        insert_rows("books", books)
        insert_rows("content_sources", content_sources)
        insert_rows("essays", essays)
        insert_rows("essay_revisions", revisions)
        insert_rows("book_tags", book_tags)

        cur.execute("SET session_replication_role = 'origin';")
        conn.commit()
        print("Commit successful.")

        cur.execute("SELECT count(*) FROM books;")
        print(f"Post books: {cur.fetchone()[0]} (expected {len(books)})")
        cur.execute("SELECT count(*) FROM essays;")
        print(f"Post essays: {cur.fetchone()[0]} (expected {len(essays)})")
        cur.execute("SELECT count(*) FROM essay_revisions;")
        print(f"Post revisions: {cur.fetchone()[0]} (expected {len(revisions)})")

    except Exception as e:
        conn.rollback()
        print(f"Error, rolled back: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
