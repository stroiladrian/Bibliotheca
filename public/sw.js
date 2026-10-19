// Bibliotheca service worker: makes the app open offline.
// Audio is NOT handled here: downloaded chapters are played from the page as blob: URLs
// (see lib/downloads.ts), which avoids range-request problems on iPhone.

const VERSION = "v2";
const SHELL = `bib-shell-${VERSION}`;
const RUNTIME = `bib-runtime-${VERSION}`;
const PAGES = "bib-pages-v1"; // book pages saved together with a download (lib/downloads.ts)
const COVERS = "bib-covers-v1";
const KEEP = [SHELL, RUNTIME, PAGES, COVERS, "bibliotheca-audio-v1"];

// the site may live under a sub-path (GitHub Pages), so every URL is relative to where this worker lives
const B = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const SHELL_URLS = ["/", "/cauta/", "/biblioteca/", "/descarcari/", "/manifest.webmanifest", "/icons/icon-192.png", "/silence.mp3"].map((p) => B + p);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith("bib-") || k.startsWith("bibliotheca-")) && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = (await caches.match(request, { ignoreSearch: true })) || null;
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") {
    const cache = await caches.open(cacheName);
    cache.put(request, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // never touch audio or range requests
  if (request.destination === "audio" || request.headers.has("range") || /\.(mp3|m4a|ogg|opus)$/i.test(url.pathname)) return;

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      event.respondWith(
        networkFirst(request, RUNTIME).catch(async () => (await caches.match(B + "/")) || Response.error()),
      );
      return;
    }
    if (url.pathname.startsWith(B + "/_next/static/")) {
      event.respondWith(cacheFirst(request, RUNTIME));
      return;
    }
    if (url.pathname.endsWith(".txt")) {
      // Next.js page data for client-side navigation
      event.respondWith(networkFirst(request, RUNTIME));
      return;
    }
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
    return;
  }

  // book covers from archive.org
  if (request.destination === "image" && /(^|\.)archive\.org$/.test(url.hostname)) {
    event.respondWith(cacheFirst(request, COVERS).catch(() => Response.error()));
  }
});
