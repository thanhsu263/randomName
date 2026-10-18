#!/usr/bin/env bash
# Regenerate all layers and render them to 3840x1080 PNGs with headless Edge.
set -e
cd "$(dirname "$0")"
python gen_sgu_bg.py
python gen_layers.py
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
DIR="$(cygpath -w "$PWD")"
for f in sgu_bg_L0 sgu_bg_L1 sgu_bg_L2 sgu_bg_L3 sgu_bg_L4 preview; do
  src="$f.svg"; [ "$f" = preview ] && src="preview.html"
  "$EDGE" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=8000 --window-size=3840,1080 \
    --screenshot="$DIR\\$f.png" "file:///$(cygpath -m "$PWD")/$src" 2>&1 | tail -1
done
