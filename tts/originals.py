#!/usr/bin/env python3
"""Original works (poems, stories) written for Bibliotheca, narrated in several voices.

Each collection is an entry in tts/books.json with "original": true, e.g.

    {"slug": "carusel-si-alte-poeme", "title": "Carusel și alte poeme", "author": "Andreea Stroila",
     "original": true, "folder": "originals/andreea-stroila",
     "model": "gemini-3.8-flash-tts", "voices": ["Gacrux", "Algieba"], ...}

Put one poem per .txt file in that folder (the first line is the title), named so they sort
in order: 01-carusel.txt, 02-plocoane.txt, 03-… Then run

    python3 tts/originals.py --all            # narrate new poems in every collection
    python3 tts/originals.py carusel-si-alte-poeme
    npm run catalog

Every poem becomes one chapter per voice ("Carusel · voce feminină", "Carusel · voce masculină").
Poems already narrated are kept; only new or edited ones use Gemini requests.
The daily run (tts/daily.sh) calls this automatically before the classics queue.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tts"))

BOOKS = ROOT / "tts" / "books.json"
AUDIO_DIR = ROOT / "public" / "audio" / "ro"
MANIFEST_DIR = ROOT / "data" / "ro"
BITRATE = 96  # poems are short; a bit more quality

VOICE_LABEL = {"Gacrux": "voce feminină", "Algieba": "voce masculină"}


def mp3_seconds(path: Path) -> float:
    # files are constant-bitrate MP3s written by this script
    return round(path.stat().st_size * 8 / (BITRATE * 1000), 1)


def narrate_collection(book: dict, force: bool) -> bool:
    model = book.get("model", "gemini-3.8-flash-tts")
    os.environ["GEMINI_TTS_MODEL"] = model
    import narrate  # reads GEMINI_TTS_MODEL at import

    narrate.GEMINI_MODEL = model
    narrate.BITRATE = BITRATE
    folder = ROOT / book["folder"]
    poems = sorted(p for p in folder.glob("*.txt"))
    if not poems:
        print(f"• {book['slug']}: no poems in {book['folder']}/ yet")
        return True
    voices = book.get("voices", ["Gacrux", "Algieba"])
    out_dir = AUDIO_DIR / book["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = MANIFEST_DIR / f"{book['slug']}.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    hashes = {c["file"]: c.get("hash") for c in old.get("chapters", [])}

    engine = None
    chapters = []
    print(f"\n▶ {book['title']} — {book['author']} · {len(poems)} poem(s) × {len(voices)} voci")
    for i, poem in enumerate(poems, 1):
        raw = poem.read_text(encoding="utf-8").strip()
        title = raw.splitlines()[0].strip()
        for voice in voices:
            file = f"{i:02d}-{voice.lower()}.mp3"
            mp3 = out_dir / file
            h = hashlib.sha1(f"{model}|{voice}|{raw}".encode()).hexdigest()[:12]
            if mp3.exists() and not force and hashes.get(file) in (h, None):
                print(f"  {title} · {voice}: already narrated")
            else:
                if engine is None:
                    key = narrate.load_key()
                    if not key:
                        sys.exit("No GEMINI_API_KEY in .env.local")
                    engine = narrate.GeminiEngine(key)
                try:
                    # the poem goes to Gemini exactly as written: line breaks and punctuation set the rhythm
                    pcm, rate = narrate.synth_split(engine, raw, voice)
                except narrate.QuotaReached:
                    print("  ⏸ Gemini's free daily limit is reached; the rest continues tomorrow.")
                    write_manifest(book, chapters, manifest_path, model, voices)
                    return False
                except narrate.Blocked:
                    print(f"  ✗ Gemini refused “{title}” ({voice}); skipping it for now.")
                    continue
                pad = narrate.silence(0.6, rate)
                narrate.write_mp3(mp3, pad + pcm + pad, rate)
                print(f"  {title} · {voice}: narrated")
            chapters.append(
                {
                    "n": len(chapters) + 1,
                    "title": f"{title} · {VOICE_LABEL.get(voice, voice)}",
                    "file": file,
                    "seconds": mp3_seconds(mp3),
                    "bytes": mp3.stat().st_size,
                    "hash": h,
                }
            )
    write_manifest(book, chapters, manifest_path, model, voices)
    from covers import make_cover

    make_cover(book)
    print(f"  ✓ {len(chapters)} track(s)")
    return True


def write_manifest(book, chapters, path, model, voices):
    if not chapters:
        return
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    names = " și ".join(f"„{v}”" for v in voices)
    manifest = {
        "slug": book["slug"],
        "engine": "gemini",
        "voice": "+".join(voices),
        "model": model,
        "narrator": f"Voci AI {names} (Google Gemini)",
        "bitrate": BITRATE,
        "source": None,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "chapters": chapters,
    }
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--all", action="store_true", help="every original collection in tts/books.json")
    ap.add_argument("--force", action="store_true", help="narrate again even if audio exists")
    args = ap.parse_args()
    books = [b for b in json.loads(BOOKS.read_text(encoding="utf-8"))["books"] if b.get("original")]
    targets = books if args.all else [b for b in books if b["slug"] in args.slugs]
    if not targets:
        ap.print_help()
        return
    for b in targets:
        if not narrate_collection(b, args.force):
            break


if __name__ == "__main__":
    main()
