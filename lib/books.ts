"use client";

import type { Book } from "./types";
import { withBase } from "@/lib/base";

// Full book data (with chapters) lives in /data/books/<id>.json so the home page stays light.
const memory = new Map<string, Promise<Book>>();

export const bookUrl = (id: string) => withBase(`/data/books/${id}.json`);

async function fetchBook(id: string): Promise<Book> {
  const url = bookUrl(id);
  try {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as Book;
  } catch {
    /* offline: try the caches below */
  }
  if (typeof caches !== "undefined") {
    const hit = await caches.match(url);
    if (hit) return (await hit.json()) as Book;
  }
  throw new Error("Nu am putut încărca această carte. Verifică conexiunea la internet.");
}

export function loadBook(id: string): Promise<Book> {
  let p = memory.get(id);
  if (!p) {
    p = fetchBook(id).catch((e) => {
      memory.delete(id);
      throw e;
    });
    memory.set(id, p);
  }
  return p;
}

/** Book pages already have the full data from the build; reuse it instead of fetching. */
export function primeBook(book: Book) {
  if (!memory.has(book.id)) memory.set(book.id, Promise.resolve(book));
}
