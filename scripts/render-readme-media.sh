#!/usr/bin/env bash
# Regenerates the README's mobile demo GIF from the demo recordings.
#
#   ./scripts/render-readme-media.sh
#
# Source clip: scripts/video-demo/output/clips/02-mobil.webm — a native 392x852
# portrait recording, so the phone fills the frame instead of sitting inside a
# downscaled 1920x1080 composite. The bezel is TAP brown (#2c1a1d) with a
# punched-out screen, and GIF transparency keeps the corners round on both
# GitHub themes.
#
# 64 colours with dither=none: the UI is flat brand colour, so dithering only
# adds noise and roughly doubles the file size.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIP="$REPO_ROOT/scripts/video-demo/output/clips/02-mobil.webm"
OUT="$REPO_ROOT/.github/assets/mobile-demo.gif"
BEZEL="$(mktemp -t bezel).png"

SCREEN_W=336
SCREEN_H=730
BEZEL_PX=12
FRAME_W=$((SCREEN_W + BEZEL_PX * 2))
FRAME_H=$((SCREEN_H + BEZEL_PX * 2))
START=3.9   # start with the dashboard painted and book covers loaded
DURATION=3.4
FPS=9

if [[ ! -f "$CLIP" ]]; then
  echo "Missing $CLIP — the demo recordings are not checked in." >&2
  exit 1
fi

python3 - "$BEZEL" "$FRAME_W" "$FRAME_H" "$BEZEL_PX" <<'PY'
import sys
from PIL import Image, ImageDraw

out, w, h, bezel = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
draw = ImageDraw.Draw(im)
draw.rounded_rectangle([0, 0, w - 1, h - 1], radius=40, fill="#2c1a1d")
draw.rounded_rectangle([bezel, bezel, w - 1 - bezel, h - 1 - bezel], radius=29, fill=(0, 0, 0, 0))
im.save(out)
PY

ffmpeg -v error -ss "$START" -t "$DURATION" -i "$CLIP" -i "$BEZEL" -filter_complex "\
[0:v]fps=$FPS,scale=$SCREEN_W:$SCREEN_H,format=rgba,pad=$FRAME_W:$FRAME_H:$BEZEL_PX:$BEZEL_PX:color=#00000000[v];\
[v][1:v]overlay=0:0[o];\
[o]split[a][b];\
[a]palettegen=reserve_transparent=1:max_colors=64[p];\
[b][p]paletteuse=alpha_threshold=128:dither=none" \
  -loop 0 -y "$OUT"

rm -f "$BEZEL"
echo "Rendered $OUT ($(du -h "$OUT" | cut -f1))"

# ---------------------------------------------------------------------------
# Desktop still: the curated reading list (TOP BOB), from the launch video.
# Cropped to the content column so the dev-only sidebar and the demo account's
# e-mail stay out, starting on a card edge and ending at the viewport fold.
# Quantised to 256 colours — flat brand UI, so it costs nothing visually and
# more than halves the file.
VIDEO="$REPO_ROOT/scripts/video-demo/output/tappka_novinky.mp4"
STILL_OUT="$REPO_ROOT/.github/assets/reading-list.png"
STILL_AT=46

if [[ -f "$VIDEO" ]]; then
  FRAME="$(mktemp -t reading-list).png"
  ffmpeg -v error -ss "$STILL_AT" -i "$VIDEO" -frames:v 1 -y "$FRAME"
  python3 - "$FRAME" "$STILL_OUT" <<'PY'
import sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
crop = Image.open(src).convert("RGB").crop((562, 98, 1709, 1080))
ImageDraw.Draw(crop).rectangle([0, 0, crop.width - 1, crop.height - 1], outline=(226, 222, 214), width=2)
crop.quantize(colors=256, dither=Image.Dither.NONE).save(out, optimize=True)
PY
  rm -f "$FRAME"
  echo "Rendered $STILL_OUT ($(du -h "$STILL_OUT" | cut -f1))"
else
  echo "Skipping reading-list.png — $VIDEO not present." >&2
fi
