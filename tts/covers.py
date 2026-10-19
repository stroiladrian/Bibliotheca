"""Typographic covers for the Romanian AI-narrated books, in the Bibliotheca style.

Used by narrate.py; you can also run it alone:  python3 tts/covers.py capra-cu-trei-iezi
Fonts (Bricolage Grotesque and Figtree, both under the SIL Open Font License) download
into tts/fonts/ the first time.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "tts" / "fonts"
COVER_DIR = ROOT / "public" / "covers"
FONTS = {
    "display": ("BricolageGrotesque.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf"),
    "body": ("Figtree.ttf", "https://raw.githubusercontent.com/google/fonts/main/ofl/figtree/Figtree%5Bwght%5D.ttf"),
}
SIZE = 1000
ACCENT = (255, 122, 69)


def _font_path(kind: str) -> Path | None:
    name, url = FONTS[kind]
    path = FONT_DIR / name
    if not path.exists():
        try:
            FONT_DIR.mkdir(parents=True, exist_ok=True)
            req = urllib.request.Request(url, headers={"User-Agent": "Bibliotheca/0.1"})
            with urllib.request.urlopen(req, timeout=120) as r:
                path.write_bytes(r.read())
        except Exception as e:  # offline: fall back to Pillow's default font
            print(f"  (could not download {name}: {e})")
            return None
    return path


def _font(kind: str, size: int, weight: int):
    from PIL import ImageFont

    path = _font_path(kind)
    if not path:
        return ImageFont.load_default(size=size)
    f = ImageFont.truetype(str(path), size)
    try:
        axes = f.get_variation_axes()
        values = []
        for ax in axes:
            name = ax.get("name", b"")
            name = name.decode() if isinstance(name, bytes) else str(name)
            if name.lower().startswith("weight"):
                values.append(weight)
            elif name.lower().startswith("optical"):
                values.append(min(ax["maximum"], max(ax["minimum"], size / 4)))
            else:
                values.append(ax.get("default", ax["minimum"]))
        f.set_variation_by_axes(values)
    except Exception:
        pass
    return f


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return tuple(int(c[i : i + 2], 16) for i in (0, 2, 4))


def _wrap(draw, text: str, font, width: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for w in words:
        test = (line + " " + w).strip()
        if draw.textlength(test, font=font) <= width or not line:
            line = test
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def make_cover(book: dict) -> Path:
    from PIL import Image, ImageDraw

    bg, fg = (_hex(c) for c in book.get("palette", ["#2A2A2E", "#F5F5F4"]))
    img = Image.new("RGB", (SIZE, SIZE), bg)
    d = ImageDraw.Draw(img)

    # quiet ring motif, offset per book so the shelf doesn't look stamped
    seed = sum(ord(ch) for ch in book["slug"])
    r = 330
    cx = 620 + (seed % 7) * 25
    cy = 300 + (seed % 5) * 30
    ring = tuple(int(b + (f - b) * 0.22) for b, f in zip(bg, fg))
    if book.get("original"):
        # original works: a softer "carousel" motif, a ring of dots around concentric circles
        import math

        cx, cy, r = 660, 340, 185
        for k, w in ((0, 3), (45, 2), (90, 2)):
            d.ellipse((cx - r + k, cy - r + k, cx + r - k, cy + r - k), outline=ring, width=w)
        for i in range(24):
            a = 2 * math.pi * i / 24
            x, y = cx + (r + 40) * math.cos(a), cy + (r + 40) * math.sin(a)
            s = 7 if i % 3 else 11
            d.ellipse((x - s, y - s, x + s, y + s), fill=ACCENT if i == 21 else ring)
    else:
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=ring, width=6)
        d.ellipse((cx - r + 70, cy - r + 70, cx + r - 70, cy + r - 70), outline=ring, width=3)

    pad = 80
    author = book["author"].upper()
    # brand mark top-right: tiny wordmark + accent dot
    mark = _font("display", 34, 800)
    mw = d.textlength("bibliotheca", font=mark)
    room = SIZE - pad * 2 - mw - 70
    for asize in range(34, 19, -2):
        small = _font("body", asize, 700)
        if d.textlength(author, font=small) <= room:
            break
    d.text((pad, pad + (34 - asize) // 2), author, font=small, fill=fg)
    d.text((SIZE - pad - mw - 22, pad - 4), "bibliotheca", font=mark, fill=fg)
    d.ellipse((SIZE - pad - 12, pad + 20, SIZE - pad, pad + 32), fill=ACCENT)

    # title: largest size that fits in at most 4 lines
    title = book["title"]
    width = SIZE - pad * 2
    for size in range(150, 54, -6):
        font = _font("display", size, 800)
        lines = _wrap(d, title, font, width)
        if len(lines) <= 4 and all(d.textlength(ln, font=font) <= width for ln in lines):
            break
    line_h = int(size * 1.0)
    y = SIZE - pad - line_h * len(lines) - 70
    for ln in lines:
        d.text((pad - 4, y), ln, font=font, fill=fg)
        y += line_h

    tag = _font("body", 30, 600)
    d.text((pad, SIZE - pad - 36), book.get("coverTag", "Narată cu voce AI"), font=tag, fill=fg)

    COVER_DIR.mkdir(parents=True, exist_ok=True)
    out = COVER_DIR / f"ro-{book['slug']}.jpg"
    img.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    return out


if __name__ == "__main__":
    books = {b["slug"]: b for b in json.loads((ROOT / "tts" / "books.json").read_text(encoding="utf-8"))["books"]}
    for slug in sys.argv[1:] or books:
        print(make_cover(books[slug]))
