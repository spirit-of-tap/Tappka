#!/usr/bin/env python3
"""Import the production book catalogue into the local dev database.

Copies only the catalogue tables:
  - highlight_categories (4)
  - tags (matched by name, existing local rows reused)
  - books (709)
  - book_tags (675, tag/name remapped to local tag IDs)

Essays, revisions, content sources, library copies and loans are untouched.

Production audit profile IDs are remapped to the local System admin because
the local profile set is not a superset of production (230 vs 98 profiles).
Foreign keys stay valid; no session_replication_role bypass is used.

Usage:
  python3 scripts/import-prod-book-catalogue.py --dry-run
  python3 scripts/import-prod-book-catalogue.py
"""
import argparse
import sys
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests

ROOT = Path(__file__).resolve().parent.parent
LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

BOOK_COLUMNS = [
    "id",
    "title_cs",
    "title_en",
    "author",
    "isbn_13",
    "description",
    "google_books_cover_url",
    "book_points",
    "page_count",
    "preview_link",
    "source",
    "external_id",
    "list_status",
    "list_status_changed_at",
    "list_status_changed_by_profile_id",
    "list_status_reason",
    "highlight_category_id",
    "is_rocket_model",
    "created_at",
    "updated_at",
]

CATEGORY_COLUMNS = [
    "id",
    "name",
    "description",
    "created_at",
    "updated_at",
]


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
            timeout=60,
        )
        r.raise_for_status()
        batch = r.json()
        rows.extend(batch)
        if len(batch) < step:
            break
        offset += step
    return rows


def local_system_profile(cur) -> str:
    cur.execute(
        """
        select id from public.profiles
        where role = 'admin'
        order by (name = 'System') desc, name
        limit 1
        """
    )
    row = cur.fetchone()
    if not row:
        raise RuntimeError("No local admin profile exists; cannot remap audit fields.")
    return row[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    env = load_env(ROOT / ".env.transfer.local")
    url = env["PRODUCTION_SUPABASE_URL"]
    key = env["PRODUCTION_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    print("Fetching catalogue from production...")
    prod_categories = fetch_all(
        url, headers, "highlight_categories", "id,name,description,created_at,updated_at"
    )
    prod_tags = fetch_all(url, headers, "tags", "id,name,created_at,updated_at")
    prod_books = fetch_all(url, headers, "books", ",".join(BOOK_COLUMNS))
    prod_book_tags = fetch_all(url, headers, "book_tags", "book_id,tag_id,created_at,updated_at")

    print(f"  highlight categories: {len(prod_categories)}")
    print(f"  tags: {len(prod_tags)}")
    print(f"  books: {len(prod_books)}")
    print(f"  book tags: {len(prod_book_tags)}")

    if args.dry_run:
        print("Dry run, exiting.")
        return

    conn = psycopg2.connect(LOCAL_DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        cur.execute("select count(*) from public.books")
        existing_books = cur.fetchone()[0]
        if existing_books:
            raise RuntimeError(
                f"Local books table already has {existing_books} rows; refusing to mix catalogues."
            )

        system_profile = local_system_profile(cur)
        print(f"Using local audit profile: {system_profile}")

        # 1. Highlight categories — preserve production IDs, remap audit fields.
        for c in prod_categories:
            cur.execute(
                """
                insert into public.highlight_categories
                  (id, name, description, created_at, updated_at,
                   created_by_profile_id, updated_by_profile_id)
                values (%s, %s, %s, coalesce(%s, now()), coalesce(%s, now()), %s, %s)
                on conflict (id) do nothing
                """,
                (
                    c["id"],
                    c["name"],
                    c.get("description"),
                    c.get("created_at"),
                    c.get("updated_at"),
                    system_profile,
                    system_profile,
                ),
            )

        # 2. Tags — local tags already exist with different IDs, so map by name.
        cur.execute("select id, name from public.tags")
        tag_id_by_name = {name: tag_id for tag_id, name in cur.fetchall()}
        prod_tag_name_by_id: dict[str, str] = {}

        for t in prod_tags:
            prod_tag_name_by_id[t["id"]] = t["name"]
            if t["name"] not in tag_id_by_name:
                cur.execute(
                    """
                    insert into public.tags
                      (id, name, created_at, updated_at,
                       created_by_profile_id, updated_by_profile_id)
                    values (%s, %s, coalesce(%s, now()), coalesce(%s, now()), %s, %s)
                    """,
                    (
                        t["id"],
                        t["name"],
                        t.get("created_at"),
                        t.get("updated_at"),
                        system_profile,
                        system_profile,
                    ),
                )
                tag_id_by_name[t["name"]] = t["id"]

        # 3. Books — production IDs preserved; audit fields remapped.
        columns = [
            *BOOK_COLUMNS,
            "created_by_profile_id",
            "updated_by_profile_id",
        ]
        values = []
        for b in prod_books:
            values.append(
                {
                    **{col: b[col] for col in BOOK_COLUMNS},
                    "created_by_profile_id": system_profile,
                    "updated_by_profile_id": system_profile,
                    "list_status_changed_by_profile_id": (
                        system_profile if b.get("list_status_changed_by_profile_id") else None
                    ),
                }
            )

        col_list = ", ".join(f'"{c}"' for c in columns)
        template = "(" + ", ".join(["%s"] * len(columns)) + ")"
        query = f'insert into public."books" ({col_list}) values %s'
        psycopg2.extras.execute_values(
            cur,
            query,
            [tuple(v[c] for c in columns) for v in values],
            template=template,
            page_size=500,
        )
        print(f"  inserted {len(values)} books")

        # 4. Book tags — map production tag IDs to local tag IDs by name.
        book_tag_rows = []
        for bt in prod_book_tags:
            tag_name = prod_tag_name_by_id.get(bt["tag_id"])
            local_tag_id = tag_id_by_name.get(tag_name) if tag_name else None
            if not local_tag_id:
                raise RuntimeError(f"Unknown production tag {bt['tag_id']} ({tag_name})")
            book_tag_rows.append(
                (
                    bt["book_id"],
                    local_tag_id,
                    bt.get("created_at"),
                    bt.get("updated_at"),
                    system_profile,
                    system_profile,
                )
            )

        psycopg2.extras.execute_values(
            cur,
            """
            insert into public.book_tags
              (book_id, tag_id, created_at, updated_at,
               created_by_profile_id, updated_by_profile_id)
            values %s
            on conflict (book_id, tag_id) do nothing
            """,
            book_tag_rows,
            template="(%s, %s, coalesce(%s, now()), coalesce(%s, now()), %s, %s)",
            page_size=500,
        )
        print(f"  inserted {len(book_tag_rows)} book-tag links")

        conn.commit()
        print("Commit successful.")

        cur.execute("select count(*) from public.books")
        books_count = cur.fetchone()[0]
        cur.execute("select count(*) from public.book_tags")
        tags_count = cur.fetchone()[0]
        cur.execute("select count(*) from public.highlight_categories")
        categories_count = cur.fetchone()[0]
        cur.execute(
            """
            select count(*) from public.book_tags bt
            left join public.tags t on t.id = bt.tag_id
            where t.id is null
            """
        )
        dangling_tags = cur.fetchone()[0]
        cur.execute(
            """
            select count(*) from public.books b
            left join public.highlight_categories c on c.id = b.highlight_category_id
            where b.highlight_category_id is not null and c.id is null
            """
        )
        dangling_categories = cur.fetchone()[0]

        print(f"Post books: {books_count} (expected {len(prod_books)})")
        print(f"Post book_tags: {tags_count} (expected {len(prod_book_tags)})")
        print(f"Post highlight_categories: {categories_count} (expected {len(prod_categories)})")
        print(f"Dangling tag refs: {dangling_tags}")
        print(f"Dangling category refs: {dangling_categories}")

        if books_count != len(prod_books) or tags_count != len(prod_book_tags):
            raise RuntimeError("Row-count mismatch after import.")
        if dangling_tags or dangling_categories:
            raise RuntimeError("Dangling references after import.")

        cur.execute(
            """
            select b.title_cs, b.author, b.book_points, b.list_status
            from public.books b
            order by b.created_at desc
            limit 5
            """
        )
        print("Newest books:")
        for row in cur.fetchall():
            print(f"  - {row[0]} / {row[1]} / {row[2]} b. / {row[3]}")

        cur.close()
        conn.close()
    except Exception as e:
        conn.rollback()
        print(f"Error, rolled back: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
