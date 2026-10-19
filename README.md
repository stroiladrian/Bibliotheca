# Bibliotheca

Free audiobooks in Romanian, with a Netflix feel (inspired by voxa.ro).

- **Recorded by people where possible:** the Romanian LibriVox recordings (Eminescu, Coșbuc, Macedonski), streamed from Internet Archive.
- **Narrated with AI everywhere else:** Romanian classics from Wikisource (Creangă, Ispirescu, Caragiale, Slavici, Eminescu, Delavrancea, Zamfirescu, Rebreanu) read by Google Gemini voices, Gacrux (female storyteller) or Algieba (male). New books appear as they are narrated; the rest show as "În curând".
- Player with resume, 15/30 s skip, speed, sleep timer, bookmarks, lock-screen controls.
- My list, in progress, finished, search with filters (category, human or AI voice, length).
- Offline downloads, installable on the phone home screen (PWA).
- No accounts, no paid services. Everything personal stays in the browser.

## Run it

Needs Node 20.9 or newer.

```bash
cd ~/Documents/Bibliotheca
npm install
npm run dev          # http://localhost:3000
```

Production build (a static site in `out/`):

```bash
npm run build
npm run preview      # serves out/ on http://localhost:3000
```

## Put it online for free (Vercel)

1. Push the repo to GitHub (commands below).
2. On vercel.com: **Add New → Project → import `Bibliotheca`**. Leave everything on the defaults and deploy.
3. Open the link on your iPhone, then Share → **Add to Home Screen**. It opens like an app, keeps playing with the screen locked and downloads work offline.

Any static host works too (Cloudflare Pages, Netlify): build command `npm run build`, output folder `out`.

## Update the LibriVox catalog

The books are listed in `catalog/curated.json` (category and Romanian blurb for each).

```bash
npm run sync         # downloads book data from LibriVox, then rebuilds the catalog
```

LibriVox has only a few Romanian recordings (all three are included). If a new one appears, add it with its LibriVox `id`, a `title`, `cats` and `blurb`, then run `npm run sync`. When a book exists both on LibriVox and in `tts/books.json`, remove it from `tts/books.json` so the human recording is used.

## Narrate the Romanian books (AI)

The list of books, in narration order, is `tts/books.json` (shortest and children's books first). Each book has a `voice`: `"Gacrux"` (female storyteller) or `"Algieba"` (male storyteller).

One-time setup (Python 3.10–3.13):

```bash
cd ~/Documents/Bibliotheca
python3 -m venv tts/.venv
source tts/.venv/bin/activate
pip install -r tts/requirements.txt
```

Put your free Gemini key (aistudio.google.com → Get API key) in `.env.local`:

```
GEMINI_API_KEY=your-key
```

**Automatic (recommended):** install the daily run once, and your Mac narrates the next books every morning at 10:20 (or as soon as it wakes up), rebuilds the catalog and shows a small notification:

```bash
cd ~/Documents/Bibliotheca
bash tts/install-daily.sh            # or: bash tts/install-daily.sh 11 30  for another time
bash tts/install-daily.sh --now      # optional: start today's run right away
bash tts/install-daily.sh --remove   # stop the daily runs
```

Logs are in `tts/logs/`. If the first log says *Operation not permitted*, macOS is blocking background access to Documents: open System Settings → Privacy & Security → Full Disk Access, click +, press Cmd+Shift+G, type `/bin/bash`, add it, then run `bash tts/install-daily.sh --now` again.

**By hand** (after 10:00 Romanian time, when the free limit resets):

```bash
cd ~/Documents/Bibliotheca
npm run narrate
```

It narrates the next books in the queue until the free daily limit (about 10 requests, roughly 30–40 minutes of audio) is reached, saves every finished part in `tts/cache/`, and updates the catalog. Run it again the next day and it continues where it stopped. The short stories finish in the first days; long novels like *Pădurea spânzuraților* take weeks.

- Texts are already downloaded in `tts/text/<slug>/`. Read through them if you want: the voice reads exactly what is in them.
- If Gemini refuses a passage (its filter sometimes mistakes famous public-domain texts for copyrighted ones), the script retries it in smaller pieces, and tells you which line to tweak if it still can't.
- No key or no internet? `python3 tts/narrate.py --engine piper <slug>` uses the offline voice "Mihai" (more robotic).
- To add a book: add an entry to `tts/books.json` with the Wikisource page title. Only authors who died more than 70 years ago.

**Original poems (Andreea Stroila):** the collection *Carusel și alte poeme* lives in `originals/andreea-stroila/`, one `.txt` per poem (first line is the title). Add a new file like `03-titlu.txt` and the daily run narrates it in both voices with Gemini 3.8 (which reads original work beautifully) and adds it to the app. To do it right away: `python3 tts/originals.py --all && npm run catalog`. Details in `originals/README.md`.

**Big books and hosting:** short stories are fine inside the repo (about 21 MB per hour of audio). Long books like Amintiri din copilărie (~4 h, ~85 MB) are better on **Internet Archive**, which is free and permanent. Upload the folder `public/audio/ro/<slug>/` to a new item on archive.org, add `"audioBase": "https://archive.org/download/<item-name>"` to that book in `tts/books.json`, run `npm run catalog`, and delete the local audio folder.

## Project map

```
app/                 pages: home, carte/[id], cauta, biblioteca, descarcari
components/          UI (Hero, Row, BookTile, MiniPlayer, FullPlayer, …)
lib/player.tsx       the audio engine (one <audio> for the whole app)
lib/store.ts         progress, my list, bookmarks, downloads (localStorage)
lib/downloads.ts     offline downloads (Cache Storage, played back as blob: URLs)
public/sw.js         service worker, so the app opens offline
catalog/             the curated list of LibriVox books
scripts/             sync-librivox.mjs, build-catalog.mjs
tts/                 Romanian narration pipeline (Python)
data/                generated catalog (committed, so builds need no network)
```

## Git

First push (create an empty repo called `Bibliotheca` on GitHub first, without a README):

```bash
cd ~/Documents/Bibliotheca
git init
git add .
git commit -m "Bibliotheca: free audiobook app"
git branch -M main
git remote add origin https://github.com/stroiladrian/Bibliotheca.git
git push -u origin main
```

Later updates:

```bash
git add .
git commit -m "Describe the change"
git push
```

## Credits

Recordings: [LibriVox](https://librivox.org) volunteers, hosted by [Internet Archive](https://archive.org). Romanian texts: [Wikisource](https://ro.wikisource.org). Voices: Google Gemini TTS (Gacrux, Algieba) and [Piper](https://github.com/OHF-Voice/piper1-gpl) "Mihai" (ro_RO). Fonts: Bricolage Grotesque and Figtree (SIL Open Font License). All classics are in the public domain. The poems by Andreea Stroila are her own work, all rights reserved.
