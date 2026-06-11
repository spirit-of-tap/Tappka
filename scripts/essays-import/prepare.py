#!/usr/bin/env python3
"""Parse the legacy Essays.csv into NDJSON for the importer.

Filters out deactivated essays and rows with empty body. Reverses the legacy
"Surname Given(s) (code)" author label into a "Given(s) Surname" display name
and emits a token-set key used to match against existing profiles.

Outputs:
  /tmp/essays.ndjson     one JSON object per kept essay
  /tmp/author_labels.json  {rawLabel: {name, key}} for every distinct author
"""
import csv, json, sys, unicodedata
from datetime import datetime

CSV_PATH = "data/Essays.csv"
OUT_NDJSON = "/tmp/essays.ndjson"
OUT_LABELS = "/tmp/author_labels.json"


def strip_accents(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def token_key(label: str) -> str:
    """Accent-insensitive, order-insensitive key from the name tokens."""
    base = label.split("(")[0]
    toks = [t for t in strip_accents(base).lower().replace(",", " ").split() if t]
    return " ".join(sorted(toks))


def display_name(label: str) -> str:
    """Legacy label is 'Surname Given(s) (code)'. Move surname to the end."""
    base = label.split("(")[0].strip()
    toks = base.split()
    if len(toks) <= 1:
        return base
    return " ".join(toks[1:] + toks[:1])


def parse_date(s: str):
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%d.%m.%Y %H:%M", "%d.%m.%Y %H:%M:%S", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).isoformat()
        except ValueError:
            continue
    return None


def main():
    kept = 0
    skipped_deactivated = 0
    skipped_empty = 0
    labels = {}

    with open(CSV_PATH, encoding="utf-8-sig", newline="") as f, \
         open(OUT_NDJSON, "w", encoding="utf-8") as out:
        for row in csv.DictReader(f):
            if row["Deactivate"] == "True":
                skipped_deactivated += 1
                continue
            html = row["essay_content"].strip()
            if not html:
                skipped_empty += 1
                continue

            label = row["AutorEditable"].strip()
            if label not in labels:
                labels[label] = {"name": display_name(label), "key": token_key(label)}

            rec = {
                "label": label,
                "title": row["Title"].strip() or "Bez názvu",
                "created": parse_date(row["VytvořenoEditable"]),
                "source_id": row["SourceID"].strip() or None,
                "html": row["essay_content"],
            }
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            kept += 1

    with open(OUT_LABELS, "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=0)

    print(f"kept essays:          {kept}")
    print(f"skipped deactivated:  {skipped_deactivated}")
    print(f"skipped empty body:   {skipped_empty}")
    print(f"distinct authors:     {len(labels)}")
    print(f"-> {OUT_NDJSON}, {OUT_LABELS}")


if __name__ == "__main__":
    sys.exit(main())
