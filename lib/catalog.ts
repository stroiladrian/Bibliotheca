import data from "@/data/catalog.json";
import type { BookLite, Catalog, Category, UpcomingBook } from "./types";

export const CATALOG = data as unknown as Catalog;
export const BOOKS: BookLite[] = CATALOG.books;
export const CATEGORIES: Category[] = CATALOG.categories;
export const UPCOMING: UpcomingBook[] = CATALOG.upcoming ?? [];

const byId = new Map(BOOKS.map((b) => [b.id, b]));

export function getBookLite(id: string): BookLite | undefined {
  return byId.get(id);
}

export function categoryTitle(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.title ?? key;
}

export function categoryBooks(key: string): BookLite[] {
  return BOOKS.filter((b) => b.cats.includes(key));
}

export const SHORT_LIMIT = 3600;

export function shortBooks(): BookLite[] {
  return BOOKS.filter((b) => b.seconds <= SHORT_LIMIT).sort((a, b) => a.seconds - b.seconds);
}

/** ISO week number, so the hero changes every Monday. */
export function weekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function featuredFor(d: Date): BookLite {
  const ids = CATALOG.featured.length ? CATALOG.featured : BOOKS.map((b) => b.id);
  const id = ids[(weekNumber(d) + d.getFullYear()) % ids.length];
  return byId.get(id) ?? BOOKS[0];
}

/** Stable pseudo-random order, so "similar" rows differ per book but not per render. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function similar(book: BookLite, n = 10): BookLite[] {
  return BOOKS.filter((b) => b.id !== book.id)
    .map((b) => ({ b, score: b.cats.filter((c) => book.cats.includes(c)).length * 1000 + (hash(book.id + b.id) % 1000) }))
    .filter((x) => x.score >= 1000)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.b);
}

export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type LengthFilter = "" | "scurte" | "medii" | "lungi" | "foarte-lungi";
export const LENGTHS: { key: LengthFilter; label: string; test: (s: number) => boolean }[] = [
  { key: "scurte", label: "Sub 30 min", test: (s) => s < 1800 },
  { key: "medii", label: "30 min – 2 ore", test: (s) => s >= 1800 && s < 2 * 3600 },
  { key: "lungi", label: "2–10 ore", test: (s) => s >= 2 * 3600 && s < 10 * 3600 },
  { key: "foarte-lungi", label: "Peste 10 ore", test: (s) => s >= 10 * 3600 },
];

export type VoiceFilter = "" | "human" | "ai";

export interface SearchFilters {
  q: string;
  cat: string;
  voice: VoiceFilter;
  len: LengthFilter;
}

const haystack = new Map(
  BOOKS.map((b) => [b.id, fold([b.title, b.titleRo, b.author, b.narrator, b.blurb].filter(Boolean).join(" "))]),
);

export function searchBooks(f: SearchFilters): BookLite[] {
  const words = fold(f.q).split(" ").filter(Boolean);
  const lenTest = LENGTHS.find((l) => l.key === f.len)?.test;
  const results = BOOKS.filter((b) => {
    if (f.cat && !b.cats.includes(f.cat)) return false;
    if (f.voice && b.narration !== f.voice) return false;
    if (lenTest && !lenTest(b.seconds)) return false;
    const h = haystack.get(b.id) ?? "";
    return words.every((w) => h.includes(w));
  });
  if (!words.length) return results;
  // titles and authors that start with the query first
  const first = words[0];
  const rank = (b: BookLite) => {
    const t = fold(b.title + " " + (b.titleRo ?? ""));
    const a = fold(b.author);
    if (t.startsWith(first) || (b.titleRo && fold(b.titleRo).startsWith(first))) return 0;
    if (a.split(" ").some((p) => p.startsWith(first))) return 1;
    if (t.includes(first)) return 2;
    return 3;
  };
  return results.sort((a, b) => rank(a) - rank(b));
}

export function searchUpcoming(f: SearchFilters): UpcomingBook[] {
  if (f.voice === "human" || f.len) return [];
  const words = fold(f.q).split(" ").filter(Boolean);
  return UPCOMING.filter((b) => {
    if (f.cat && !b.cats.includes(f.cat)) return false;
    const h = fold([b.title, b.author, b.blurb].join(" "));
    return words.every((w) => h.includes(w));
  });
}
