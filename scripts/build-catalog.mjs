#!/usr/bin/env node
// Builds the app catalog from
//   data/librivox.json      (made by `npm run sync`)
//   tts/books.json + data/ro/<slug>.json   (Romanian AI narrations made by tts/narrate.py)
// into
//   data/catalog.json                 small index imported by the app
//   public/data/books/<id>.json       full book with chapters, fetched by the player
//
// Runs offline. `npm run build` calls it automatically.

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => JSON.parse(await readFile(path.join(ROOT, p), "utf8"));

const SMALL = new Set(["a", "an", "the", "of", "and", "in", "on", "at", "to", "for", "or", "by", "de", "la", "si", "și", "din", "cu", "pe", "lui"]);

function tidyTitle(t) {
  let s = String(t).trim().replace(/\b(chapter|capitolul|part|book)\s+0+(\d)/gi, "$1 $2");
  const letters = s.replace(/[^A-Za-zĂÂÎȘȚăâîșț]/g, "");
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    s = s
      .toLowerCase()
      .split(/(\s+)/)
      .map((w, i) => {
        if (/^\s+$/.test(w)) return w;
        if (/^[ivxlc]+[.,:)]?$/i.test(w) && w.length <= 6) return w.toUpperCase();
        if (i > 0 && SMALL.has(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join("");
  }
  return s;
}

// GitHub Pages serves the site under /Bibliotheca: local covers and audio need that prefix
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const withBase = (p) => (p && p.startsWith("/") && !p.startsWith("//") ? BASE + p : p);

function years(a) {
  if (!a?.born && !a?.died) return undefined;
  const clean = (y) => String(y).replace(/^(\d{1,4}).*$/, "$1");
  if (a.born && a.died) return `${clean(a.born)}–${clean(a.died)}`;
  return undefined;
}

function joinNames(names) {
  if (names.length <= 1) return names[0] ?? "Autor necunoscut";
  return names.slice(0, -1).join(", ") + " și " + names.at(-1);
}

async function main() {
  const curated = await read("catalog/curated.json");
  const curatedByKey = new Map(curated.books.map((b) => [b.key, b]));
  const librivox = existsSync(path.join(ROOT, "data/librivox.json")) ? await read("data/librivox.json") : { books: [] };
  const tts = await read("tts/books.json");

  const full = [];

  // LibriVox books, in curated order
  for (const lv of librivox.books) {
    const c = curatedByKey.get(lv.key);
    if (!c) continue;
    const ro = lv.language === "Romanian";
    const narrator =
      lv.readers.length === 1 ? lv.readers[0] : `${lv.readers.length} voluntari LibriVox`;
    full.push({
      id: `lv${lv.id}`,
      key: lv.key,
      title: c.title ?? lv.title,
      titleRo: c.titleRo,
      author: joinNames(lv.authors.map((a) => a.name)),
      authorYears: lv.authors.length === 1 ? years(lv.authors[0]) : undefined,
      lang: ro ? "ro" : "en",
      narration: "human",
      narrator,
      seconds: lv.seconds,
      chapters: lv.chapters.length,
      cover: withBase(lv.cover) ?? undefined,
      cats: c.cats,
      blurb: c.blurb,
      kbps: 64,
      about: lv.description || undefined,
      sources: [
        lv.librivoxUrl && { label: "Pagina LibriVox", url: lv.librivoxUrl },
        lv.archiveUrl && { label: "Fișierele pe Archive.org", url: lv.archiveUrl },
        lv.textUrl && { label: "Textul original", url: lv.textUrl },
      ].filter(Boolean),
      chapterList: lv.chapters.map((ch) => ({
        n: ch.n,
        title: tidyTitle(ch.title),
        url: ch.url,
        seconds: ch.seconds,
      })),
    });
  }

  // Romanian AI narrations that have been generated
  let aiCount = 0;
  for (const b of tts.books) {
    const manifestPath = path.join(ROOT, "data/ro", `${b.slug}.json`);
    if (!existsSync(manifestPath)) continue;
    const m = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!m.chapters?.length) continue;
    if (m.engine !== "gemini") continue; // old offline "Mihai" (Piper) narrations wait for their Gemini version
    const base = (b.audioBase ?? `/audio/ro/${b.slug}`).replace(/\/$/, "");
    aiCount++;
    full.push({
      id: `ro-${b.slug}`,
      key: b.slug,
      title: b.title,
      author: b.author,
      authorYears: b.authorYears,
      year: b.year,
      lang: "ro",
      narration: "ai",
      original: b.original || undefined,
      narrator: m.narrator ?? "Voce AI „Mihai” (Piper)",
      seconds: Math.round(m.chapters.reduce((s, c) => s + c.seconds, 0)),
      chapters: m.chapters.length,
      cover: withBase(b.cover ?? `/covers/ro-${b.slug}.jpg`),
      palette: b.palette,
      cats: b.cats,
      blurb: b.blurb,
      kbps: m.bitrate ?? 48,
      about: undefined,
      sources: [m.source && { label: "Textul pe Wikisource", url: m.source }].filter(Boolean),
      chapterList: m.chapters.map((c) => ({
        n: c.n,
        title: c.title,
        url: withBase(`${base}/${c.file}`),
        seconds: Math.round(c.seconds),
      })),
    });
  }

  // books queued for narration but not recorded yet: shown as "În curând"
  const upcoming = [];
  for (const b of tts.books) {
    if (full.some((x) => x.key === b.slug)) continue;
    const cover = existsSync(path.join(ROOT, "public/covers", `ro-${b.slug}.jpg`)) ? withBase(`/covers/ro-${b.slug}.jpg`) : undefined;
    upcoming.push({ id: `ro-${b.slug}`, title: b.title, author: b.author, authorYears: b.authorYears, year: b.year, cats: b.cats, blurb: b.blurb, palette: b.palette, cover });
  }

  // AI narrations in queue order (tts/books.json), then the LibriVox recordings
  const order = new Map(tts.books.map((b, i) => [b.slug, i]));
  const rank = (b) => (b.narration === "ai" ? order.get(b.key) ?? 999 : 1000);
  full.sort((a, b) => rank(a) - rank(b));

  const keyToId = new Map(full.map((b) => [b.key, b.id]));
  const lite = full.map(({ chapterList, about, sources, key, ...rest }) => rest);
  const catalog = {
    generatedAt: new Date().toISOString(),
    categories: curated.categories,
    featured: curated.featured.map((k) => keyToId.get(k)).filter(Boolean),
    books: lite,
    upcoming,
  };

  await mkdir(path.join(ROOT, "data"), { recursive: true });
  await writeFile(path.join(ROOT, "data/catalog.json"), JSON.stringify(catalog, null, 1) + "\n");

  const booksDir = path.join(ROOT, "public/data/books");
  await mkdir(booksDir, { recursive: true });
  const keep = new Set(full.map((b) => `${b.id}.json`));
  for (const f of await readdir(booksDir)) {
    if (!keep.has(f)) await rm(path.join(booksDir, f)).catch(() => {});
  }
  for (const { key, ...b } of full) {
    await writeFile(path.join(booksDir, `${b.id}.json`), JSON.stringify(b) + "\n");
  }
  const hours = Math.round(full.reduce((s, b) => s + b.seconds, 0) / 3600);
  console.log(`Catalog: ${full.length} books (${aiCount} narrated with AI, ${full.length - aiCount} LibriVox), ${hours} h of audio · ${upcoming.length} waiting to be narrated.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
