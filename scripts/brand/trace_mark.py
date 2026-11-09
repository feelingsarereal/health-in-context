#!/usr/bin/env python3
"""SL39 step 1: trace Daniel's loop mark (content-pack/brand/health-in-context-mark.png) to one single-colour SVG path.
A trace only: crop to the mark's bounding box, threshold, fit curves, fill LOF Orange. Needs `pip install potracer pillow numpy`.
Run from the app folder: python3 scripts/brand/trace_mark.py"""
import numpy as np, potrace
from PIL import Image

SRC, OUT, FILL = 'content-pack/brand/health-in-context-mark.png', 'public/brand/health-in-context-mark.svg', '#ff7d2f'
img = Image.open(SRC).convert('RGBA')
flat = Image.new('RGBA', img.size, (255, 255, 255, 255))
flat.alpha_composite(img)   # the PNG's clear areas are black underneath
rgb = np.asarray(flat.convert('RGB'), dtype=float)
ink = (255 - rgb[:, :, 2]) / 255 > 0.5   # the blue channel separates the orange from the white most cleanly
ys, xs = np.where(ink)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
crop = ink[y0:y1, x0:x1]
# potracer reads False as ink
paths = potrace.Bitmap(~crop).trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.4)
f = lambda p: f'{p.x:.1f} {p.y:.1f}'
d = []
for c in paths:
    d.append(f'M{f(c.start_point)}')
    for s in c.segments:
        d.append(f'L{f(s.c)}L{f(s.end_point)}' if s.is_corner else f'C{f(s.c1)} {f(s.c2)} {f(s.end_point)}')
    d.append('Z')
h, w = crop.shape
open(OUT, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="{FILL}"><path fill-rule="evenodd" d="{"".join(d)}"/></svg>\n')
print(f'crop {w}x{h} at ({x0},{y0}); {len(paths)} path(s), {sum(len(c.segments) for c in paths)} segments; {len("".join(d))} bytes of path')
