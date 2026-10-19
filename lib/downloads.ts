"use client";

// Offline listening: chapters are saved in the browser's Cache Storage and played back
// from a blob: URL, which works on iPhone too (no service-worker range tricks needed).

import type { Book } from "./types";
import { bookUrl } from "./books";
import { getState, setDownload } from "./store";

export const AUDIO_CACHE = "bibliotheca-audio-v1";
export const PAGES_CACHE = "bib-pages-v1"; // shared with public/sw.js

const running = new Map<string, AbortController>();

export const canDownload = () => typeof window !== "undefined" && "caches" in window;

export function isDownloading(id: string) {
  return running.has(id);
}

export async function downloadBook(book: Book): Promise<void> {
  if (!canDownload() || running.has(book.id)) return;
  const controller = new AbortController();
  running.set(book.id, controller);
  const total = book.chapterList.length;
  let done = 0;
  let bytes = 0;
  const report = (status: "downloading" | "done" | "partial" | "error") =>
    setDownload(book.id, { status, done, total, bytes, at: Date.now() });

  try {
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* not supported: fine */
    }
    const cache = await caches.open(AUDIO_CACHE);
    await cache.put(bookUrl(book.id), new Response(JSON.stringify(book), { headers: { "Content-Type": "application/json" } }));
    // keep the book page available offline too
    caches
      .open(PAGES_CACHE)
      .then((c) => c.add(`/carte/${book.id}/`))
      .catch(() => {});

    report("downloading");
    for (const ch of book.chapterList) {
      if (controller.signal.aborted) throw new DOMException("aborted", "AbortError");
      const existing = await cache.match(ch.url);
      if (existing) {
        bytes += Number(existing.headers.get("Content-Length")) || 0;
        done++;
        report("downloading");
        continue;
      }
      const res = await fetch(ch.url, { signal: controller.signal, mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      await cache.put(
        ch.url,
        new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg", "Content-Length": String(blob.size) } }),
      );
      bytes += blob.size;
      done++;
      report("downloading");
    }
    report("done");
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    report(done > 0 ? "partial" : aborted ? "partial" : "error");
    if (aborted && done === 0) setDownload(book.id, null);
    if (!aborted) throw err;
  } finally {
    running.delete(book.id);
  }
}

export function cancelDownload(id: string) {
  running.get(id)?.abort();
}

export async function removeDownload(book: Book) {
  cancelDownload(book.id);
  if (canDownload()) {
    const cache = await caches.open(AUDIO_CACHE);
    await Promise.all(book.chapterList.map((ch) => cache.delete(ch.url)));
    await cache.delete(bookUrl(book.id));
  }
  setDownload(book.id, null);
}

/** If this chapter was downloaded, a blob: URL to play it offline. */
export async function offlineUrl(url: string): Promise<string | null> {
  if (!canDownload()) return null;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    const hit = await cache.match(url);
    if (!hit) return null;
    return URL.createObjectURL(await hit.blob());
  } catch {
    return null;
  }
}

export function hasAnyDownload(id: string) {
  const d = getState().downloads[id];
  return !!d && d.done > 0;
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e) return null;
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}
