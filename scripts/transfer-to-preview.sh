#!/usr/bin/env bash
set -euo pipefail

# ─── Transfer data from local → preview Supabase DB ───
# Usage:
#   export PREVIEW_DB_PASSWORD="uVITmb8yeepbeFWn"
#   export PREVIEW_SERVICE_ROLE_KEY="your_key"  # from dashboard Settings→API
#   bash scripts/transfer-to-preview.sh

# Config
PREVIEW_HOST="db.wykcqwmrxvgoomltrrlo.supabase.co"
PREVIEW_PORT="5432"
PREVIEW_DB="postgres"
PREVIEW_USER="postgres"
PREVIEW_URL="https://wykcqwmrxvgoomltrrlo.supabase.co"
LOCAL_DSN="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
PREVIEW_DSN="postgresql://${PREVIEW_USER}:${PREVIEW_DB_PASSWORD}@${PREVIEW_HOST}:${PREVIEW_PORT}/${PREVIEW_DB}?sslmode=require"
DUMPS_DIR="/tmp/preview-transfer"

mkdir -p "$DUMPS_DIR"

echo "━━━ Transfer to Preview ━━━"
echo ""

# ─── Step 1: Dump data from local DB ───
echo "1/6 Dumping data from local DB..."
pg_dump "$LOCAL_DSN" \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-acl \
  --no-comments \
  -t teams \
  -t profiles \
  -t books \
  -t tags \
  -t book_tags \
  -t essays \
  -t essay_revisions \
  -t essay_comments \
  -f "$DUMPS_DIR/dump.sql"
echo "  ✓ $(wc -l < "$DUMPS_DIR/dump.sql" | tr -d ' ') lines dumped"

# ─── Step 2: Fix localhost image URLs → preview ───
echo "2/6 Fixing image URLs..."
PREVIEW_STORAGE="${PREVIEW_URL}/storage/v1/object/public/images"
LOCAL_STORAGE="http://127.0.0.1:54321/storage/v1/object/public/images"
sed -i '' "s|${LOCAL_STORAGE}|${PREVIEW_STORAGE}|g" "$DUMPS_DIR/dump.sql"
echo "  ✓ URLs rewritten to preview"

# ─── Step 3: Add ON CONFLICT for profiles ───
echo "3/6 Adding conflict handling for profiles..."
sed -i '' '/^INSERT INTO public\.profiles /s/$/ ON CONFLICT (work_email) DO NOTHING;/' "$DUMPS_DIR/dump.sql"
echo "  ✓ Profiles will skip existing by work_email"

# ─── Step 4: Upload images to preview storage ───
IMAGES_DIR="scripts/essayimport/Downloaded_Images"
if [ -d "$IMAGES_DIR" ] && [ -n "${PREVIEW_SERVICE_ROLE_KEY:-}" ]; then
  echo "4/6 Uploading images to preview storage..."

  IMAGE_FILES=("$IMAGES_DIR"/*)
  TOTAL=${#IMAGE_FILES[@]}
  COUNT=0

  for img in "${IMAGE_FILES[@]}"; do
    [ -f "$img" ] || continue
    BASENAME=$(basename "$img")
    ESSAY_ID="${BASENAME%%_*}"
    ORIG_FILENAME="${BASENAME#*_}"
    STORAGE_PATH="essay-images/import/${ESSAY_ID}/${ORIG_FILENAME}"

    case "${BASENAME,,}" in
      *.png)  MIME="image/png" ;;
      *.gif)  MIME="image/gif" ;;
      *.webp) MIME="image/webp" ;;
      *)      MIME="image/jpeg" ;;
    esac

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST "${PREVIEW_URL}/storage/v1/object/images/${STORAGE_PATH}" \
      -H "Authorization: Bearer ${PREVIEW_SERVICE_ROLE_KEY}" \
      -H "Content-Type: ${MIME}" \
      -H "x-upsert: true" \
      --data-binary "@$img")

    if [ "$HTTP_CODE" = "200" ]; then
      COUNT=$((COUNT + 1))
    else
      echo "  ✗ $BASENAME → $HTTP_CODE"
    fi

    if [ $((COUNT % 200)) -eq 0 ] && [ "$COUNT" -gt 0 ]; then
      echo "  ... $COUNT/$TOTAL"
    fi
  done
  echo "  ✓ $COUNT/$TOTAL images uploaded"
else
  echo "4/6 Skipping image upload (PREVIEW_SERVICE_ROLE_KEY not set or images dir missing)"
  echo "  Set PREVIEW_SERVICE_ROLE_KEY and re-run for images"
fi

# ─── Step 5: Restore to preview DB ───
echo "5/6 Restoring data to preview DB..."
echo "  Existing profile rows will be preserved (ON CONFLICT DO NOTHING)"

# Disable triggers to avoid interference from profile hooks
PGPASSWORD="$PREVIEW_DB_PASSWORD" psql "$PREVIEW_DSN" \
  --quiet \
  -c "SET session_replication_role = replica;" \
  -f "$DUMPS_DIR/dump.sql" \
  -c "SET session_replication_role = origin;" \
  2>"$DUMPS_DIR/errors.log"

ERROR_COUNT=$(wc -l < "$DUMPS_DIR/errors.log" | tr -d ' ')
if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "  ⚠  Errors detected:"
  head -20 "$DUMPS_DIR/errors.log"
else
  echo "  ✓ No errors"
fi

# ─── Step 6: Verify ───
echo "6/6 Post-transfer verification..."
echo ""
printf "  %-22s %s\n" "Table" "Rows"
printf "  %-22s %s\n" "-----" "----"
for table in teams profiles books tags book_tags essays essay_revisions essay_comments; do
  count=$(PGPASSWORD="$PREVIEW_DB_PASSWORD" psql "$PREVIEW_DSN" -t -A -c "SELECT count(*) FROM $table;" 2>/dev/null || echo "?")
  printf "  %-22s %s\n" "$table" "$count"
done

echo ""
echo "━━━ Transfer complete! ━━━"
echo "  Dump file: $DUMPS_DIR/dump.sql"
echo "  Errors:    $DUMPS_DIR/errors.log"