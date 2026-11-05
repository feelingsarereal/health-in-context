#!/bin/sh
# The manual's screenshots as WebP (about a quarter of the PNG size); the PNGs are working files and not committed.
cd "$(dirname "$0")/../img" || exit 1
for f in *.png; do cwebp -quiet -q 90 "$f" -o "${f%.png}.webp" && rm "$f"; done
