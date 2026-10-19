"use client";

// Everything personal (progress, my list, bookmarks, downloads, speed) lives in this
// browser's localStorage. No account, nothing leaves the device.

import { useSyncExternalStore } from "react";

export interface Progress {
  ch: number; // chapter index, 0-based
  pos: number; // seconds into that chapter
  elapsed: number; // seconds into the whole book
  at: number; // last listened, ms
  done?: boolean;
}

export interface Bookmark {
  ch: number;
  pos: number;
  at: number;
}

export interface DownloadInfo {
  status: "downloading" | "done" | "partial" | "error";
  done: number;
  total: number;
  bytes: number;
  at: number;
}

export interface State {
  progress: Record<string, Progress>;
  saved: string[];
  bookmarks: Record<string, Bookmark[]>;
  downloads: Record<string, DownloadInfo>;
  rate: number;
  volume: number;
}

const KEY = "bibliotheca:v1";
const EMPTY: State = { progress: {}, saved: [], bookmarks: {}, downloads: {}, rate: 1, volume: 1 };

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(raw: string | null): State {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    state = readStorage(localStorage.getItem(KEY));
  } catch {
    state = EMPTY;
  }
  // a download interrupted by closing the tab is not "downloading" any more
  const downloads = { ...state.downloads };
  let changed = false;
  for (const [id, d] of Object.entries(downloads)) {
    if (d.status === "downloading") {
      downloads[id] = { ...d, status: d.done > 0 ? "partial" : "error" };
      changed = true;
    }
  }
  if (changed) state = { ...state, downloads };
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = readStorage(e.newValue);
    emit();
  });
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function getState(): State {
  load();
  return state;
}

export function update(fn: (s: State) => State) {
  load();
  state = fn(state);
  persist();
  emit();
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Select a slice. The selector must return something stable (a slice or a primitive). */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(EMPTY),
  );
}

// ---- actions ----

export function saveProgress(id: string, p: Omit<Progress, "at">) {
  update((s) => ({ ...s, progress: { ...s.progress, [id]: { ...p, at: Date.now() } } }));
}

export function forgetProgress(id: string) {
  update((s) => {
    const progress = { ...s.progress };
    delete progress[id];
    return { ...s, progress };
  });
}

export function toggleSaved(id: string): boolean {
  let nowSaved = false;
  update((s) => {
    nowSaved = !s.saved.includes(id);
    return { ...s, saved: nowSaved ? [id, ...s.saved] : s.saved.filter((x) => x !== id) };
  });
  return nowSaved;
}

export function addBookmark(id: string, ch: number, pos: number) {
  update((s) => ({
    ...s,
    bookmarks: { ...s.bookmarks, [id]: [{ ch, pos, at: Date.now() }, ...(s.bookmarks[id] ?? [])].slice(0, 50) },
  }));
}

export function removeBookmark(id: string, at: number) {
  update((s) => ({ ...s, bookmarks: { ...s.bookmarks, [id]: (s.bookmarks[id] ?? []).filter((b) => b.at !== at) } }));
}

export function setRate(rate: number) {
  update((s) => ({ ...s, rate }));
}

export function setDownload(id: string, info: DownloadInfo | null) {
  update((s) => {
    const downloads = { ...s.downloads };
    if (info) downloads[id] = info;
    else delete downloads[id];
    return { ...s, downloads };
  });
}

export function setVolume(volume: number) {
  update((s) => ({ ...s, volume }));
}
