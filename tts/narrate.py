#!/usr/bin/env python3
"""Narrate Romanian books with an AI voice and save them for the app.

    python3 tts/narrate.py capra-cu-trei-iezi           # one book
    python3 tts/narrate.py capra-cu-trei-iezi ivan-turbinca
    python3 tts/narrate.py --force capra-cu-trei-iezi   # redo it
    python3 tts/narrate.py --engine piper capra-cu-trei-iezi   # offline voice

Two voices engines:
  gemini  (default)  Google Gemini voices, natural and expressive. Free with a key from
                     aistudio.google.com, saved in .env.local as GEMINI_API_KEY=…
                     The free tier has a daily limit: if it is reached the script stops,
                     keeps everything done so far in tts/cache/, and continues next time
                     you run the same command.
  piper              The offline voice "Mihai". Lower quality, but no key and no limits.

Each book in tts/books.json picks its Gemini voice with "voice" (e.g. "Gacrux" for a female
storyteller, "Algieba" for a male one).

Before narrating, download the text:  python3 tts/fetch_text.py <slug>
After narrating, rebuild the catalog:  npm run catalog

Writes
    public/audio/ro/<slug>/01.mp3 …   the audio (mono MP3, 48 kbps)
    public/covers/ro-<slug>.jpg        a cover in the Bibliotheca style
    data/ro/<slug>.json                chapter titles and durations, read by `npm run catalog`
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import wave
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tts"))

BOOKS = ROOT / "tts" / "books.json"
TEXT_DIR = ROOT / "tts" / "text"
VOICE_DIR = ROOT / "tts" / "voices"
CACHE_DIR = ROOT / "tts" / "cache"
AUDIO_DIR = ROOT / "public" / "audio" / "ro"
MANIFEST_DIR = ROOT / "data" / "ro"

BITRATE = 48  # kbps; plenty for a single speaking voice

GEMINI_MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")  # newer TTS models refuse famous public-domain texts
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_DEFAULT_VOICE = "Algieba"
GEMINI_CHUNK_CHARS = 3500  # ~3–4 minutes of speech per request; blocked passages are retried in smaller pieces

PIPER_VOICE = "ro_RO-mihai-medium"
PIPER_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/ro/ro_RO/mihai/medium/"
PIPER_LENGTH_SCALE = 1.06

ORDINALS = [
    "întâi", "al doilea", "al treilea", "al patrulea", "al cincilea", "al șaselea", "al șaptelea",
    "al optulea", "al nouălea", "al zecelea", "al unsprezecelea", "al doisprezecelea",
    "al treisprezecelea", "al paisprezecelea", "al cincisprezecelea", "al șaisprezecelea",
    "al șaptesprezecelea", "al optsprezecelea", "al nouăsprezecelea", "al douăzecilea",
]
ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50}


class QuotaReached(Exception):
    pass


class Blocked(Exception):
    """Gemini refused a passage (its filter sometimes mistakes famous public-domain texts for copyrighted ones)."""


# ---------------------------------------------------------------- text helpers


def roman_to_int(s: str) -> int | None:
    s = s.strip().upper().rstrip(".")
    if not s or any(c not in ROMAN for c in s):
        return None
    total, prev = 0, 0
    for c in reversed(s):
        v = ROMAN[c]
        total += -v if v < prev else v
        prev = max(prev, v)
    return total


def chapter_label(title: str) -> tuple[str, str]:
    """Returns (title shown in the app, sentence the narrator says)."""
    t = title.strip()
    num = roman_to_int(t) or (int(t) if t.isdigit() else None)
    if num:
        spoken = f"Capitolul {ORDINALS[num - 1]}." if num <= len(ORDINALS) else f"Capitolul {num}."
        return f"Capitolul {t}", spoken
    return t, t.rstrip(".") + "."


ABBREVIATIONS = [
    (r"\bD-lui\b", "Domnului"), (r"\bD-l\b", "Domnul"), (r"\bd-l\b", "domnul"),
    (r"\bD-na\b", "Doamna"), (r"\bd-na\b", "doamna"), (r"\bD-nei\b", "Doamnei"), (r"\bd-nei\b", "doamnei"),
    (r"\bD-ra\b", "Domnișoara"), (r"\bd-ra\b", "domnișoara"),
    (r"\b[Dd]-ta\b", "dumneata"), (r"\b[Dd]-tale\b", "dumitale"), (r"\b[Dd]-voastră\b", "dumneavoastră"),
    (r"\b[Dd]-sa\b", "dumnealui"), (r"\b[Dd]-lor\b", "dumnealor"), (r"\b[Dd]-nealui\b", "dumnealui"),
    (r"\bmam' ?mare\b", "mamare"), (r"\bMam' ?mare\b", "Mamare"),
]


def expand(text: str) -> str:
    text = text.replace("\xa0", " ")
    for pat, rep in ABBREVIATIONS:
        text = re.sub(pat, rep, text)
    return text.replace("...", "…")


def for_piper(text: str) -> str:
    """Piper reads punctuation literally, so strip dialogue dashes and quotes."""
    text = expand(text)
    text = re.sub(r"^\s*[–—-]\s*", "", text, flags=re.M)
    text = re.sub(r"\s[–—-]\s", ", ", text)
    text = re.sub(r"[„”“\"«»]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def for_gemini(text: str) -> str:
    """Gemini uses dashes and quotes to act out dialogue, so keep them."""
    text = expand(text)
    return re.sub(r"[ \t]+", " ", text).strip()


def chunk_paragraphs(paragraphs: list[str], limit: int) -> list[str]:
    """Groups paragraphs into requests of at most `limit` characters, never splitting a sentence."""
    pieces: list[str] = []
    for p in paragraphs:
        if len(p) <= limit:
            pieces.append(p)
            continue
        sentence, buf = re.split(r"(?<=[.!?…])\s+", p), ""
        for s in sentence:
            if buf and len(buf) + len(s) + 1 > limit:
                pieces.append(buf)
                buf = s
            else:
                buf = f"{buf} {s}".strip()
        if buf:
            pieces.append(buf)
    chunks, cur = [], ""
    for p in pieces:
        if cur and len(cur) + len(p) + 2 > limit:
            chunks.append(cur)
            cur = p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    return chunks


# ---------------------------------------------------------------- engines


def load_key() -> str | None:
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"].strip()
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


class GeminiEngine:
    name = "gemini"

    def __init__(self, key: str):
        self.key = key

    def label(self, voice: str) -> str:
        return f"Voce AI „{voice}” (Google Gemini)"

    def synth(self, text: str, voice: str) -> tuple[bytes, int]:
        body = {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
            },
        }
        req = urllib.request.Request(
            GEMINI_URL.format(model=GEMINI_MODEL),
            data=json.dumps(body).encode(),
            headers={"x-goog-api-key": self.key, "Content-Type": "application/json"},
        )
        for attempt in range(12):
            try:
                with urllib.request.urlopen(req, timeout=300) as r:
                    data = json.load(r)
                break
            except urllib.error.HTTPError as e:
                detail = e.read().decode(errors="replace")
                if e.code == 429:
                    if re.search(r"per ?day|PerDay|RequestsPerDay", detail, re.I):
                        raise QuotaReached(detail[:300])
                    # per-minute limit: wait and try again
                    wait = min(_retry_delay(detail) or 60, 120)
                    print(f"    (free tier: too many requests this minute, waiting {wait:.0f}s)", flush=True)
                    time.sleep(wait + 2)
                    continue
                if e.code >= 500 and attempt < 5:
                    time.sleep(5 * (attempt + 1))
                    continue
                raise SystemExit(f"Gemini error {e.code}: {detail[:400]}")
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt < 5:
                    time.sleep(5 * (attempt + 1))
                    continue
                raise SystemExit(f"Cannot reach Gemini: {e}")
        else:
            raise QuotaReached("too many retries")
        try:
            part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
        except (KeyError, IndexError):
            reason = (data.get("candidates") or [{}])[0].get("finishReason", "")
            if reason in ("OTHER", "RECITATION", "PROHIBITED_CONTENT", "SAFETY", "BLOCKLIST", "SPII") or data.get("promptFeedback"):
                raise Blocked(reason or "blocked")
            raise SystemExit(f"Gemini returned no audio: {json.dumps(data)[:400]}")
        raw = base64.b64decode(part["data"])
        if raw[:4] == b"RIFF":
            w = wave.open(io.BytesIO(raw))
            return w.readframes(w.getnframes()), w.getframerate()
        m = re.search(r"rate=(\d+)", part.get("mimeType", ""))
        return raw, int(m.group(1)) if m else 24000


def _retry_delay(detail: str) -> float | None:
    m = re.search(r'"retryDelay":\s*"([\d.]+)s"', detail)
    return float(m.group(1)) if m else None


class PiperEngine:
    name = "piper"

    def __init__(self):
        try:
            from piper import PiperVoice
            from piper.config import SynthesisConfig
        except ImportError:
            sys.exit("Piper is not installed. Run: pip install -r tts/requirements.txt")
        VOICE_DIR.mkdir(parents=True, exist_ok=True)
        model = VOICE_DIR / f"{PIPER_VOICE}.onnx"
        for path in (model, VOICE_DIR / f"{PIPER_VOICE}.onnx.json"):
            if not path.exists():
                print(f"Downloading voice file {path.name}…")
                req = urllib.request.Request(PIPER_URL + path.name, headers={"User-Agent": "Bibliotheca/0.1"})
                with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
                    while chunk := r.read(1 << 20):
                        f.write(chunk)
        self.voice = PiperVoice.load(str(model))
        self.cfg = SynthesisConfig(length_scale=PIPER_LENGTH_SCALE)

    def label(self, voice: str) -> str:
        return "Voce AI „Mihai” (Piper)"

    def synth(self, text: str, voice: str) -> tuple[bytes, int]:
        pcm = b"".join(c.audio_int16_bytes for c in self.voice.synthesize(text, syn_config=self.cfg))
        return pcm, self.voice.config.sample_rate


# ---------------------------------------------------------------- audio


def silence(seconds: float, rate: int) -> bytes:
    return b"\x00\x00" * int(rate * seconds)


def resample(pcm: bytes, src: int, dst: int) -> bytes:
    if src == dst:
        return pcm
    import numpy as np

    a = np.frombuffer(pcm, dtype=np.int16).astype(np.float32)
    n = int(len(a) * dst / src)
    out = np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a)
    return out.astype(np.int16).tobytes()


def write_mp3(path: Path, pcm: bytes, rate: int) -> None:
    import lameenc

    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_bytes(enc.encode(pcm) + enc.flush())
    tmp.replace(path)


def split_in_two(text: str) -> tuple[str, str] | None:
    """Splits near the middle, at a paragraph break if possible, else at a sentence end."""
    mid = len(text) // 2
    for sep in ("\n\n", "\n", ". ", "! ", "? ", "; ", ", "):
        cuts = [m.end() for m in re.finditer(re.escape(sep), text)]
        if cuts:
            cut = min(cuts, key=lambda c: abs(c - mid))
            if 0.2 * len(text) < cut < 0.8 * len(text):
                return text[:cut].strip(), text[cut:].strip()
    return None


def synth_split(engine, text: str, voice: str, depth: int = 0) -> tuple[bytes, int]:
    """Synthesizes text; if Gemini blocks it, tries again in two smaller halves."""
    try:
        return engine.synth(text, voice)
    except Blocked:
        halves = split_in_two(text) if len(text) > 250 and depth < 4 else None
        if not halves:
            raise
        print(f"      (Gemini's filter refused a passage, retrying it in 2 smaller pieces)", flush=True)
        a, ra = synth_split(engine, halves[0], voice, depth + 1)
        b, rb = synth_split(engine, halves[1], voice, depth + 1)
        return a + silence(0.35, ra) + resample(b, rb, ra), ra


# ---------------------------------------------------------------- narration


def narrate_book(engine, book: dict, force: bool) -> bool:
    """Returns True when the whole book is done, False if the daily limit stopped it."""
    slug = book["slug"]
    text_dir = TEXT_DIR / slug
    meta_path = text_dir / "chapters.json"
    if not meta_path.exists():
        sys.exit(f"No text for {slug} yet. Run: python3 tts/fetch_text.py {slug}")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    voice = book.get("voice", GEMINI_DEFAULT_VOICE) if engine.name == "gemini" else PIPER_VOICE
    out_dir = AUDIO_DIR / slug
    manifest_path = MANIFEST_DIR / f"{slug}.json"
    old = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    same_voice = old.get("engine") == engine.name and old.get("voice") == voice
    old_by_file = {c["file"]: c for c in old.get("chapters", [])} if same_voice else {}

    chapters = meta["chapters"]
    total = len(chapters)
    print(f"\n▶ {book['title']} — {book['author']} · {engine.label(voice)} · {total} capitol{'e' if total > 1 else ''}")
    results = []
    for ch in chapters:
        n = ch["n"]
        txt = text_dir / ch["file"]
        mp3 = out_dir / f"{n:02d}.mp3"
        shown, spoken_title = chapter_label(ch["title"])
        if total == 1:
            shown = book["title"]
        prev = old_by_file.get(mp3.name)
        if mp3.exists() and prev and not force and mp3.stat().st_mtime >= txt.stat().st_mtime:
            print(f"  {n:02d} already narrated, skipping")
            results.append({**prev, "title": shown})
            continue

        paragraphs = [p.strip() for p in txt.read_text(encoding="utf-8").split("\n\n") if p.strip()]
        intro = []
        if n == 1:
            intro.append(f"{book['title']}, de {book['author']}.")
        if total > 1:
            intro.append(spoken_title)
        clean = for_gemini if engine.name == "gemini" else for_piper
        body = [clean(p) for p in paragraphs]
        if n == total:
            body.append("Sfârșit.")
        if engine.name == "gemini":
            parts = [("\n\n".join(intro), 0.9)] if intro else []
            parts += [(c, 0.5) for c in chunk_paragraphs(body, GEMINI_CHUNK_CHARS)]
        else:
            parts = [(t, 0.9) for t in intro] + [(p, 0.28 if len(p) < 45 else 0.6) for p in body]

        started = time.time()
        rate = 24000 if engine.name == "gemini" else None
        audio: list[bytes] = []
        cache = CACHE_DIR / slug
        cache.mkdir(parents=True, exist_ok=True)
        for i, (text, pause) in enumerate(parts):
            key = hashlib.sha1(f"{engine.name}|{voice}|{GEMINI_MODEL if engine.name == 'gemini' else ''}|{text}".encode()).hexdigest()[:16]
            cached = cache / f"{n:02d}-{i:03d}-{key}.wav"
            if cached.exists():
                with wave.open(str(cached)) as w:
                    pcm, r = w.readframes(w.getnframes()), w.getframerate()
            else:
                try:
                    pcm, r = synth_split(engine, text, voice)
                except Blocked:
                    sys.exit(
                        f"\n  ✗ Gemini keeps refusing this passage of {slug} (chapter {n}, part {i + 1}):\n"
                        f"    “{text[:160]}…”\n"
                        f"    Edit it slightly in tts/text/{slug}/{ch['file']} (e.g. modern spelling), or use --engine piper for this book."
                    )
                except QuotaReached:
                    done = sum(1 for f in cache.glob("*.wav"))
                    print(
                        f"\n  ⏸  Gemini's free daily limit (about 10 requests a day) is reached. {done} part(s) of this book are saved in tts/cache/{slug}/.\n"
                        f"     Run the same command again later (usually tomorrow) and it continues where it stopped."
                    )
                    return False
                if engine.name == "gemini":
                    with wave.open(str(cached), "wb") as w:
                        w.setnchannels(1)
                        w.setsampwidth(2)
                        w.setframerate(r)
                        w.writeframes(pcm)
            rate = rate or r
            audio.append(resample(pcm, r, rate) + silence(pause, rate))
            if engine.name == "gemini":
                print(f"    {n:02d} part {i + 1}/{len(parts)}", flush=True)
        pcm = silence(0.4, rate) + b"".join(audio) + silence(0.8, rate)
        write_mp3(mp3, pcm, rate)
        seconds = len(pcm) / 2 / rate
        print(f"  {n:02d} {shown}: {seconds / 60:.1f} min of audio in {time.time() - started:.0f}s")
        results.append({"n": n, "title": shown, "file": mp3.name, "seconds": round(seconds, 1), "bytes": mp3.stat().st_size})

    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "slug": slug,
        "engine": engine.name,
        "voice": voice,
        "narrator": engine.label(voice),
        "bitrate": BITRATE,
        "source": meta.get("source"),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "chapters": results,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    from covers import make_cover

    cover = make_cover(book)
    mins = sum(c["seconds"] for c in results) / 60
    print(f"  ✓ {mins:.0f} min total · cover {cover.relative_to(ROOT)} · manifest {manifest_path.relative_to(ROOT)}")
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slugs", nargs="*", help="book slugs from tts/books.json")
    ap.add_argument("--queue", action="store_true", help="narrate every book in tts/books.json that isn't done yet, in order")
    ap.add_argument("--engine", choices=["gemini", "piper"], help="default: gemini if a key is set, else piper")
    ap.add_argument("--force", action="store_true", help="narrate again even if audio exists")
    args = ap.parse_args()

    cfg = json.loads(BOOKS.read_text(encoding="utf-8"))
    by_slug = {b["slug"]: b for b in cfg["books"]}
    for s in args.slugs:
        if s not in by_slug:
            sys.exit(f"Unknown slug “{s}”. Add it to tts/books.json first.")
    if not args.slugs and not args.queue:
        ap.print_help()
        return

    key = load_key()
    engine_name = args.engine or ("gemini" if key else "piper")
    if engine_name == "gemini":
        if not key:
            sys.exit("No Gemini key. Put GEMINI_API_KEY=… in .env.local (free key from aistudio.google.com), or use --engine piper.")
        engine = GeminiEngine(key)
    else:
        engine = PiperEngine()

    slugs = list(args.slugs)
    if args.queue:
        for b in cfg["books"]:
            if b.get("original"):
                continue  # original works are narrated by tts/originals.py
            m = MANIFEST_DIR / f"{b['slug']}.json"
            done = m.exists() and json.loads(m.read_text(encoding="utf-8")).get("engine") == engine.name
            if not done and b["slug"] not in slugs:
                slugs.append(b["slug"])
        if not slugs:
            print("Every book in tts/books.json is narrated. Add more books to the list to continue.")
            return
        print(f"Queue: {len(slugs)} book(s) left, starting with {by_slug[slugs[0]]['title']}.")
    from fetch_text import fetch as fetch_text

    for s in slugs:
        if not (TEXT_DIR / s / "chapters.json").exists():
            fetch_text(by_slug[s])
        if not narrate_book(engine, by_slug[s], args.force):
            print("\nStopped for today. Already finished books are saved; run `npm run catalog` to see them in the app.")
            return
    print("\nDone. Now run: npm run catalog")


if __name__ == "__main__":
    main()
