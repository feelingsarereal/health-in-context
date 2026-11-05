"""SL27 point 9: a tiny test font, made the way the user guide's PDF went wrong — an icon at a private-use code point,
and "(" / ")" alternates reachable only through the 'case' feature (no code point of their own). Run once with
fontTools; the .ttf it writes is the checked-in fixture: python3 tests/fixtures/make-fixture-font.py
The font is variable (one weight axis), like Inter."""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
import os

def rect(x0, y0, x1, y1):
    p = TTGlyphPen(None)
    p.moveTo((x0, y0)); p.lineTo((x0, y1)); p.lineTo((x1, y1)); p.lineTo((x1, y0)); p.closePath()
    return p.glyph()

def paren(left, dy=0):
    p = TTGlyphPen(None)
    if left:
        pts = [(300, -150), (120, 100), (100, 350), (120, 600), (300, 850), (340, 820), (190, 600), (170, 350), (190, 100), (340, -120)]
    else:
        pts = [(60, -120), (210, 100), (230, 350), (210, 600), (60, 820), (100, 850), (280, 600), (300, 350), (280, 100), (100, -150)]
    pts = [(x, y + dy) for x, y in pts]
    p.moveTo(pts[0])
    for q in pts[1:]:
        p.lineTo(q)
    p.closePath()
    return p.glyph()

digits = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
letters = [chr(c) for c in range(ord('a'), ord('z') + 1)] + [chr(c) for c in range(ord('A'), ord('Z') + 1)]
order = ['.notdef', 'space', 'parenleft', 'parenright', 'parenleft.case', 'parenright.case', 'iconhome', 'period', 'comma'] + digits + letters
# as in Inter, the 'case' alternates also have private-use code points of their own (U+E081, U+E082): the PDF's
# ToUnicode then names those, not "("
cmap = {0x20: 'space', 0x28: 'parenleft', 0x29: 'parenright', 0x2E: 'period', 0x2C: 'comma', 0xE900: 'iconhome', 0xE081: 'parenleft.case', 0xE082: 'parenright.case'}
for i, d in enumerate(digits):
    cmap[0x30 + i] = d
for l in letters:
    cmap[ord(l)] = l
glyphs = {'.notdef': rect(50, 0, 450, 700), 'space': TTGlyphPen(None).glyph(), 'parenleft': paren(True), 'parenright': paren(False),
          'parenleft.case': paren(True, 80), 'parenright.case': paren(False, 80), 'iconhome': rect(80, 0, 620, 620),
          'period': rect(100, 0, 200, 100), 'comma': rect(100, -100, 200, 100)}
for i, d in enumerate(digits):
    glyphs[d] = rect(60, 0, 440 - i * 10, 700)
for i, l in enumerate(letters):
    glyphs[l] = rect(50 + (i % 5) * 10, 0, 430, 500 + (i % 7) * 30)
fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({g: (700 if g == 'iconhome' else 500, 0) for g in order})
fb.setupHorizontalHeader(ascent=900, descent=-200)
fb.setupNameTable({'familyName': 'SL27 Fixture', 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=900, sTypoDescender=-200, usWinAscent=900, usWinDescent=200)
fb.setupPost()
# a variable font (one weight axis), as Inter is: Chrome prints it as a Type 3 font, which is how the guide's PDF lost
# the alternates' Unicode
fb.setupFvar(axes=[('wght', 100, 400, 900, 'Weight')], instances=[])
fb.setupGvar({g: [] for g in order})
addOpenTypeFeaturesFromString(fb.font, 'languagesystem DFLT dflt; feature case { sub parenleft by parenleft.case; sub parenright by parenright.case; } case;')
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sl27-fixture-font.ttf')
fb.save(out)
print(out, os.path.getsize(out))
