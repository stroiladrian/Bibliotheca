#!/usr/bin/env node
// Pulls the curated LibriVox books (catalog/curated.json) from the LibriVox API
// and saves a cleaned copy to data/librivox.json.
//
//   npm run sync            -> uses the ids pinned in catalog/librivox.lock.json
//   npm run sync -- --refresh   -> searches again and re-picks the best recording
//
// The first time a book has no pinned id, the script searches LibriVox, picks the
// best version (one narrator, newest, has cover art) and pins it in the lock file
// so later runs are repeatable. Edit the lock file to choose a different version.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CURATED = path.join(ROOT, "catalog/curated.json");
const LOCK = path.join(ROOT, "catalog/librivox.lock.json");
const OUT = path.join(ROOT, "data/librivox.json");

const API = "https://librivox.org/api/feed/audiobooks/";
const UA = "Bibliotheca/0.1 (free audiobook app; github.com/stroiladrian/Bibliotheca)";
const DELAY_MS = 1200; // be gentle: LibriVox is run by volunteers

const refresh = process.argv.includes("--refresh");
const only = argValue("--only"); // sync a single key, e.g. --only dracula

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params, attempt = 1) {
  const url = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", ...params })) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 404) return []; // LibriVox answers 404 when nothing matches
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 4000 * attempt;
    console.warn(`  ${res.status} from LibriVox, retrying in ${Math.round(wait / 1000)}s…`);
    await sleep(wait);
    return api(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`LibriVox ${res.status} for ${url}`);
  const json = await res.json();
  return json.books ?? [];
}

const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim();

const stripArticle = (t) => t.replace(/^(the|a|an)\s+/i, "");

function readersOf(book) {
  const names = new Set();
  for (const s of book.sections ?? []) for (const r of s.readers ?? []) names.add(r.display_name);
  return [...names];
}

function score(book, wanted) {
  const title = fold(book.title);
  const want = fold(stripArticle(wanted.title));
  let s = 0;
  const bare = stripArticle(title.replace(/[,;]?\s*\(?(version|vers\.)\s*\d+[^)]*\)?\s*$/i, "").trim());
  if (bare === want) s += 50;
  else if (bare.startsWith(want)) s += 10;
  if (/dramatic|abridged|excerpt|selection|version \d+ \(/i.test(book.title)) s -= 60;
  const readers = readersOf(book).length;
  if (readers === 1) s += 30;
  else if (readers <= 3) s += 10;
  if (book.coverart_jpg) s += 8;
  s += Math.min(Number(book.id) / 2000, 10); // newer projects tend to sound better
  return s;
}

async function findBest(wanted) {
  const q = "^" + stripArticle(wanted.title);
  const books = await api({ title: q, extended: 1, coverart: 1, limit: 50 });
  const lang = wanted.language ?? "English";
  const author = fold(wanted.author);
  const candidates = books.filter(
    (b) =>
      b.language === lang &&
      Number(b.totaltimesecs) > 0 &&
      (b.sections?.length ?? 0) > 0 &&
      b.url_zip_file &&
      (b.authors ?? []).some((a) => fold(`${a.first_name} ${a.last_name}`).includes(author)),
  );
  candidates.sort((a, b) => score(b, wanted) - score(a, wanted));
  return candidates;
}

const https = (u) =>
  u ? String(u).replace(/^http:\/\//, "https://").replace("://www.archive.org/", "://archive.org/") : null;

function cleanText(html) {
  return String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function cleanChapterTitle(t, n) {
  const s = String(t ?? "")
    .replace(/^\s*\d{1,3}\s*[-–.:]\s*/, "")
    .trim();
  return s || `Capitolul ${n}`;
}

function normalize(book, key) {
  const readers = readersOf(book);
  return {
    key,
    id: Number(book.id),
    title: book.title.replace(/\s*\((version|vers\.)\s*\d+[^)]*\)\s*$/i, "").trim(),
    language: book.language,
    authors: (book.authors ?? []).map((a) => ({
      name: `${a.first_name ?? ""} ${a.last_name ?? ""}`.replace(/\s+/g, " ").trim(),
      born: a.dob || null,
      died: a.dod || null,
    })),
    description: cleanText(book.description),
    seconds: Number(book.totaltimesecs),
    cover: https(book.coverart_jpg),
    thumb: https(book.coverart_thumbnail),
    librivoxUrl: https(book.url_librivox),
    archiveUrl: https(book.url_iarchive),
    textUrl: https(book.url_text_source),
    genres: (book.genres ?? []).map((g) => g.name),
    readers,
    chapters: (book.sections ?? [])
      .slice()
      .sort((a, b) => Number(a.section_number) - Number(b.section_number))
      .map((s, i) => ({
        n: i + 1,
        title: cleanChapterTitle(s.title, i + 1),
        url: https(s.listen_url),
        seconds: Number(s.playtime) || 0,
        readers: (s.readers ?? []).map((r) => r.display_name),
      }))
      .filter((c) => c.url),
  };
}

async function main() {
  const curated = JSON.parse(await readFile(CURATED, "utf8"));
  const lock = existsSync(LOCK) ? JSON.parse(await readFile(LOCK, "utf8")) : {};
  const previous = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : { books: [] };
  const prevByKey = new Map(previous.books.map((b) => [b.key, b]));

  const out = [];
  const failed = [];
  for (const wanted of curated.books) {
    if (only && wanted.key !== only) {
      if (prevByKey.has(wanted.key)) out.push(prevByKey.get(wanted.key));
      continue;
    }
    try {
      let id = wanted.id ?? (refresh ? null : lock[wanted.key]);
      let book;
      if (!id) {
        const candidates = await findBest(wanted);
        if (!candidates.length) throw new Error("no matching LibriVox recording");
        book = candidates[0];
        id = Number(book.id);
        const alts = candidates
          .slice(1, 4)
          .map((b) => `${b.id} (${readersOf(b).length} voci)`)
          .join(", ");
        console.log(`✓ ${wanted.key}: picked ${id} "${book.title}", ${readersOf(book).length} voce/voci${alts ? ` · alternative: ${alts}` : ""}`);
      } else {
        const [b] = await api({ id, extended: 1, coverart: 1 });
        if (!b) throw new Error(`LibriVox id ${id} not found`);
        book = b;
        console.log(`✓ ${wanted.key}: ${id} "${book.title}"`);
      }
      lock[wanted.key] = Number(id);
      out.push(normalize(book, wanted.key));
    } catch (err) {
      failed.push(wanted.key);
      console.error(`✗ ${wanted.key}: ${err.message}`);
      if (prevByKey.has(wanted.key)) out.push(prevByKey.get(wanted.key));
    }
    await sleep(DELAY_MS);
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ syncedAt: new Date().toISOString(), books: out }, null, 1) + "\n");
  await writeFile(LOCK, JSON.stringify(sortKeys(lock), null, 2) + "\n");
  console.log(`\nSaved ${out.length} books to data/librivox.json${failed.length ? ` · failed: ${failed.join(", ")}` : ""}`);
  console.log("Next: npm run catalog");
}

function sortKeys(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
