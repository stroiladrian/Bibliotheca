#!/usr/bin/env python3
"""Download a public-domain Romanian text from ro.wikisource.org and split it into chapters.

    python3 tts/fetch_text.py capra-cu-trei-iezi        # one book from tts/books.json
    python3 tts/fetch_text.py --all                      # every book that has no text yet

Writes tts/text/<slug>/01.txt, 02.txt … plus chapters.json with the chapter titles.
Open the .txt files and fix anything odd before narrating: what is in them is
exactly what the voice will read.

Only uses the Python standard library.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS = ROOT / "tts" / "books.json"
TEXT_DIR = ROOT / "tts" / "text"
API = "https://ro.wikisource.org/w/api.php"
UA = "Bibliotheca/0.1 (free audiobook app; github.com/stroiladrian/Bibliotheca)"

SKIP_CLASSES = (
    "ws-noexport", "ws-header", "wst-header", "noprint", "mw-editsection", "reference",
    "mw-references-wrap", "references", "reflist", "ws-pagenum", "pagenum", "navbox",
    "metadata", "wst-subsol", "mw-cite-backlink", "toc",
)
SKIP_TAGS = {"style", "script", "table", "sup", "figure", "img", "noscript", "math"}
VOID = {"br", "img", "hr", "meta", "link", "input", "wbr", "col", "source", "area"}
BLOCKS = {"p", "dd", "li", "h2", "h3", "h4", "blockquote"}
STOP_HEADINGS = re.compile(r"^(note|note de subsol|referin[țt]e|bibliografie|surse|vezi și)\b", re.I)


def api_get(params: dict, attempt: int = 1) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code in (429, 503) and attempt < 8:
            wait = int(e.headers.get("retry-after") or 5) + attempt * 2
            print(f"  Wikisource is busy ({e.code}), waiting {wait}s…")
            time.sleep(wait)
            return api_get(params, attempt + 1)
        raise


class Extractor(HTMLParser):
    """Collects paragraphs and headings from Wikisource HTML, skipping navigation and notes."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, bool]] = []
        self.blocks: list[tuple[str, str]] = []
        self.buf: list[str] = []
        self.kind: str | None = None

    def skipping(self) -> bool:
        return any(skip for _, skip in self.stack)

    def handle_starttag(self, tag, attrs):
        cls = (dict(attrs).get("class") or "").split()
        if tag == "br":
            if not self.skipping():
                self.buf.append("\n")
            return
        if tag in VOID:
            return
        skip = tag in SKIP_TAGS or any(c in cls for c in SKIP_CLASSES)
        self.stack.append((tag, skip))
        if tag in BLOCKS and not self.skipping():
            self.flush()
            self.kind = "h" if tag in ("h2", "h3", "h4") else "p"

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        while self.stack:  # MediaWiki HTML is well-formed; this is just defensive
            t, _ = self.stack.pop()
            if t == tag:
                break
        if tag in BLOCKS or tag == "div":
            self.flush()

    def handle_data(self, data):
        if self.skipping():
            return
        if self.kind is None:
            if not data.strip():
                return
            self.kind = "p"
        self.buf.append(data)

    def flush(self):
        text = "".join(self.buf)
        self.buf = []
        kind, self.kind = self.kind, None
        text = text.replace("\xa0", " ")
        lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in text.split("\n")]
        text = "\n".join(ln for ln in lines if ln)
        if text and kind:
            self.blocks.append((kind, text))


def page_html(title: str) -> tuple[str, str]:
    data = api_get({"action": "parse", "page": title, "prop": "text", "redirects": "1"})
    if "error" in data:
        hits = api_get({"action": "query", "list": "search", "srsearch": f'intitle:"{title}"', "srlimit": "1"})
        found = hits.get("query", {}).get("search", [])
        if not found:
            raise SystemExit(f"Wikisource has no page called “{title}”. Put the exact page title in tts/books.json.")
        title = found[0]["title"]
        print(f"  using Wikisource page “{title}”")
        data = api_get({"action": "parse", "page": title, "prop": "text", "redirects": "1"})
    return data["parse"]["title"], data["parse"]["text"]


def split_chapters(blocks: list[tuple[str, str]], book_title: str) -> list[dict]:
    chapters: list[dict] = []
    current: dict | None = None
    for kind, text in blocks:
        if kind == "h":
            if STOP_HEADINGS.match(text):
                break
            current = {"title": text.strip(" .:"), "paragraphs": []}
            chapters.append(current)
            continue
        if text.startswith("▲") or text.lower().startswith("începutul paginii"):
            continue
        if current is None:
            current = {"title": book_title, "paragraphs": []}
            chapters.append(current)
        current["paragraphs"].append(text)
    # fold a short untitled preface into the first real chapter
    if len(chapters) > 1 and chapters[0]["title"] == book_title and sum(len(p) for p in chapters[0]["paragraphs"]) < 600:
        chapters[1]["paragraphs"] = chapters[0]["paragraphs"] + chapters[1]["paragraphs"]
        chapters.pop(0)
    return [c for c in chapters if c["paragraphs"]]


def clean(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"\[\d+\]|\[nota \d+\]", "", text)
    text = text.replace("ş", "ș").replace("ţ", "ț").replace("Ş", "Ș").replace("Ţ", "Ț")
    text = re.sub(r"\s+([?!;:,.])", r"\1", text)
    return text.strip()


def fetch(book: dict, force: bool = False) -> None:
    slug = book["slug"]
    out = TEXT_DIR / slug
    if out.exists() and any(out.glob("*.txt")) and not force:
        print(f"• {slug}: text already downloaded (use --force to download again)")
        return
    print(f"• {slug}: downloading “{book['wikisource']}”…")
    page_title, raw = page_html(book["wikisource"])
    parser = Extractor()
    parser.feed(raw)
    parser.flush()
    chapters = split_chapters(parser.blocks, book["title"])
    if not chapters:
        raise SystemExit(f"No text found on “{page_title}”.")
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.txt"):
        old.unlink()
    meta = []
    for i, ch in enumerate(chapters, 1):
        body = "\n\n".join(clean(p) for p in ch["paragraphs"] if clean(p))
        (out / f"{i:02d}.txt").write_text(body + "\n", encoding="utf-8")
        meta.append({"n": i, "title": ch["title"], "file": f"{i:02d}.txt", "words": len(body.split())})
    (out / "chapters.json").write_text(
        json.dumps({"source": f"https://ro.wikisource.org/wiki/{urllib.parse.quote(page_title.replace(' ', '_'))}", "chapters": meta}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    words = sum(m["words"] for m in meta)
    print(f"  {len(meta)} chapter(s), {words} words (≈ {round(words / 150)} min of audio)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="*", help="book slugs from tts/books.json")
    ap.add_argument("--all", action="store_true", help="every book in tts/books.json")
    ap.add_argument("--force", action="store_true", help="download again even if text exists")
    args = ap.parse_args()
    books = json.loads(BOOKS.read_text(encoding="utf-8"))["books"]
    by_slug = {b["slug"]: b for b in books}
    targets = books if args.all else [by_slug.get(s) or sys.exit(f"Unknown slug: {s}") for s in args.slugs]
    if not targets:
        ap.print_help()
        return
    for b in targets:
        fetch(b, force=args.force)
        time.sleep(1.5)


if __name__ == "__main__":
    main()
