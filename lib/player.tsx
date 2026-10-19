"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Book } from "./types";
import { loadBook } from "./books";
import { offlineUrl } from "./downloads";
import { getState, saveProgress, setRate as storeRate, setVolume as storeVolume } from "./store";
import { useToast } from "@/components/Toast";

export type Sleep = { kind: "off" } | { kind: "timer"; endsAt: number; minutes: number } | { kind: "chapter" };

export interface PlayerState {
  book: Book | null;
  index: number;
  playing: boolean;
  buffering: boolean;
  error: string | null;
  rate: number;
  volume: number;
  volumeSupported: boolean;
  sleep: Sleep;
  expanded: boolean;
  offline: boolean;
}

export interface PlayerTime {
  time: number;
  duration: number;
}

export interface PlayOptions {
  index?: number;
  time?: number;
}

interface PlayerApi extends PlayerState {
  play(target: string | Book, opts?: PlayOptions): Promise<void>;
  toggle(): void;
  pause(): void;
  seek(seconds: number): void;
  skip(delta: number): void;
  next(): void;
  prev(): void;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  cycleRate(): void;
  cycleSleep(): void;
  setExpanded(open: boolean): void;
  retry(): void;
}

export const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SLEEP_STEPS = [15, 30, 45, 60];
const SILENCE = "/silence.mp3";
const SAVE_EVERY_MS = 5000;

const PlayerCtx = createContext<PlayerApi | null>(null);
const TimeCtx = createContext<PlayerTime>({ time: 0, duration: 0 });

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerCtx);
  if (!ctx) throw new Error("usePlayer outside PlayerProvider");
  return ctx;
}

export function usePlayerTime(): PlayerTime {
  return useContext(TimeCtx);
}

/** Seconds from the start of the book to the start of chapter `index`. */
export function chapterOffset(book: Book, index: number): number {
  let s = 0;
  for (let i = 0; i < index && i < book.chapterList.length; i++) s += book.chapterList[i].seconds;
  return s;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    book: null,
    index: 0,
    playing: false,
    buffering: false,
    error: null,
    rate: 1,
    volume: 1,
    volumeSupported: false,
    sleep: { kind: "off" },
    expanded: false,
    offline: false,
  });
  const [time, setTime] = useState<PlayerTime>({ time: 0, duration: 0 });

  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingSeek = useRef<number | null>(null);
  const loadToken = useRef(0);
  const blobUrl = useRef<string | null>(null);
  const lastSave = useRef(0);
  const lastPositionState = useRef(0);
  const hasSource = useRef(false); // false while only the last book is shown (restored, not loaded)

  const patch = useCallback((p: Partial<PlayerState>) => setState((s) => ({ ...s, ...p })), []);

  // ---------- persistence ----------
  const saveNow = useCallback((done = false) => {
    const { book, index } = stateRef.current;
    const audio = audioRef.current;
    if (!book || !audio || !hasSource.current) return;
    const pos = pendingSeek.current ?? audio.currentTime ?? 0;
    saveProgress(book.id, { ch: index, pos, elapsed: chapterOffset(book, index) + pos, done });
    lastSave.current = Date.now();
  }, []);

  // ---------- media session (lock screen, headphones, car) ----------
  const updateMediaSession = useCallback((book: Book, index: number) => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ch = book.chapterList[index];
    const artwork = book.cover
      ? [{ src: new URL(book.cover, location.href).href, sizes: book.narration === "ai" ? "1000x1000" : "300x300", type: "image/jpeg" }]
      : [];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: book.title,
        artist: ch && book.chapterList.length > 1 ? `${book.author} · ${ch.title}` : book.author,
        album: "Bibliotheca",
        artwork,
      });
    } catch {
      /* old browsers */
    }
  }, []);

  // ---------- loading a chapter ----------
  const loadChapter = useCallback(
    async (book: Book, index: number, startAt: number, autoplay: boolean) => {
      const audio = audioRef.current;
      const ch = book.chapterList[index];
      if (!audio || !ch) return;
      const token = ++loadToken.current;
      patch({ book, index, error: null, buffering: autoplay, offline: false });
      setTime({ time: startAt, duration: ch.seconds });
      pendingSeek.current = startAt > 0 ? startAt : null;

      const local = await offlineUrl(ch.url);
      if (token !== loadToken.current) {
        if (local) URL.revokeObjectURL(local);
        return;
      }
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = local;

      hasSource.current = true;
      audio.src = local ?? ch.url;
      audio.defaultPlaybackRate = stateRef.current.rate;
      audio.playbackRate = stateRef.current.rate;
      audio.load();
      patch({ offline: !!local });
      updateMediaSession(book, index);
      if (autoplay) {
        try {
          await audio.play();
        } catch (e) {
          const name = (e as Error)?.name;
          if (token !== loadToken.current || name === "AbortError") return;
          patch({ playing: false, buffering: false });
          if (name !== "NotAllowedError") patch({ error: "Nu am putut porni redarea." });
        }
      }
    },
    [patch, updateMediaSession],
  );

  const unlock = useCallback(() => {
    // iPhone only lets audio start from a tap. Starting a silent clip synchronously inside the
    // tap "unlocks" the element so the real chapter can start after the async loading below.
    const audio = audioRef.current;
    if (!audio || hasSource.current) return;
    audio.src = SILENCE;
    audio.play().catch(() => {});
  }, []);

  // ---------- public controls ----------
  const play = useCallback(
    async (target: string | Book, opts: PlayOptions = {}) => {
      unlock();
      const cur = stateRef.current;
      const audio = audioRef.current;
      let book: Book;
      try {
        book = typeof target === "string" ? await loadBook(target) : target;
      } catch (e) {
        toast((e as Error).message);
        return;
      }
      const saved = getState().progress[book.id];
      const canResume = saved && !saved.done;
      const index = opts.index ?? (canResume ? Math.min(saved.ch, book.chapterList.length - 1) : 0);
      const startAt = opts.time ?? (opts.index === undefined && canResume ? Math.max(0, saved.pos - 3) : 0);

      if (audio && hasSource.current && cur.book?.id === book.id && cur.index === index) {
        if (opts.time !== undefined) audio.currentTime = opts.time;
        if (audio.paused) audio.play().catch(() => {});
        return;
      }
      if (cur.book && cur.book.id !== book.id) saveNow();
      await loadChapter(book, index, startAt, true);
    },
    [loadChapter, saveNow, toast, unlock],
  );

  const pause = useCallback(() => audioRef.current?.pause(), []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    const { book } = stateRef.current;
    if (!audio || !book) return;
    if (!hasSource.current) void play(book);
    else if (audio.paused) audio.play().catch(() => {});
  }, [play]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const { book } = stateRef.current;
    if (!audio || !book) return;
    if (!hasSource.current) {
      void play(book);
      return;
    }
    if (audio.paused) {
      audio.play().catch(() => patch({ error: "Nu am putut porni redarea." }));
    } else audio.pause();
  }, [play, patch]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const { book, index } = stateRef.current;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : book?.chapterList[index]?.seconds ?? 0;
      const t = Math.max(0, Math.min(seconds, Math.max(0, dur - 0.5)));
      if (!hasSource.current && book) {
        void play(book, { index, time: t });
        return;
      }
      if (audio.readyState >= 1) audio.currentTime = t;
      else pendingSeek.current = t;
      setTime((x) => ({ ...x, time: t }));
      saveNow();
    },
    [play, saveNow],
  );

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      const { book, index } = stateRef.current;
      if (!audio || !book) return;
      const t = (pendingSeek.current ?? audio.currentTime) + delta;
      if (t < 0 && index > 0) {
        const prev = book.chapterList[index - 1];
        void loadChapter(book, index - 1, Math.max(0, prev.seconds + t), !audio.paused);
        return;
      }
      seek(t);
    },
    [loadChapter, seek],
  );

  const next = useCallback(() => {
    const { book, index } = stateRef.current;
    const audio = audioRef.current;
    if (!book || !audio || index + 1 >= book.chapterList.length) return;
    void loadChapter(book, index + 1, 0, hasSource.current ? !audio.paused : true);
  }, [loadChapter]);

  const prev = useCallback(() => {
    const { book, index } = stateRef.current;
    const audio = audioRef.current;
    if (!book || !audio) return;
    if (audio.currentTime > 5 || index === 0) {
      seek(0);
      return;
    }
    void loadChapter(book, index - 1, 0, hasSource.current ? !audio.paused : true);
  }, [loadChapter, seek]);

  const setVolume = useCallback(
    (volume: number) => {
      const v = Math.max(0, Math.min(1, volume));
      if (audioRef.current) audioRef.current.volume = v;
      patch({ volume: v });
      storeVolume(v);
    },
    [patch],
  );

  const setRate = useCallback(
    (rate: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.defaultPlaybackRate = rate;
        audio.playbackRate = rate;
      }
      patch({ rate });
      storeRate(rate);
    },
    [patch],
  );

  const cycleRate = useCallback(() => {
    const i = RATES.indexOf(stateRef.current.rate);
    setRate(RATES[(i + 1) % RATES.length] ?? 1);
  }, [setRate]);

  const cycleSleep = useCallback(() => {
    const s = stateRef.current.sleep;
    let nextSleep: Sleep;
    if (s.kind === "off") nextSleep = { kind: "timer", minutes: SLEEP_STEPS[0], endsAt: Date.now() + SLEEP_STEPS[0] * 60000 };
    else if (s.kind === "timer") {
      const i = SLEEP_STEPS.indexOf(s.minutes);
      nextSleep =
        i + 1 < SLEEP_STEPS.length
          ? { kind: "timer", minutes: SLEEP_STEPS[i + 1], endsAt: Date.now() + SLEEP_STEPS[i + 1] * 60000 }
          : { kind: "chapter" };
    } else nextSleep = { kind: "off" };
    patch({ sleep: nextSleep });
    toast(
      nextSleep.kind === "off"
        ? "Cronometrul de somn e oprit"
        : nextSleep.kind === "chapter"
          ? "Se oprește la finalul capitolului"
          : `Se oprește în ${nextSleep.minutes} de minute`,
    );
  }, [patch, toast]);

  const setExpanded = useCallback((open: boolean) => patch({ expanded: open }), [patch]);

  const retry = useCallback(() => {
    const { book, index } = stateRef.current;
    const audio = audioRef.current;
    if (!book || !audio) return;
    void loadChapter(book, index, audio.currentTime || 0, true);
  }, [loadChapter]);

  // ---------- audio element events ----------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const isSilence = () => audio.src.endsWith(SILENCE);

    const onLoaded = () => {
      if (isSilence()) return;
      audio.playbackRate = stateRef.current.rate;
      if (pendingSeek.current !== null) {
        const t = Math.min(pendingSeek.current, Math.max(0, (audio.duration || Infinity) - 1));
        audio.currentTime = t;
        pendingSeek.current = null;
      }
      setTime({ time: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
    };
    const onTime = () => {
      if (isSilence()) return;
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      setTime({ time: audio.currentTime, duration: d });
      const now = Date.now();
      if (!audio.paused && now - lastSave.current > SAVE_EVERY_MS) saveNow();
      if (now - lastPositionState.current > 1000 && "mediaSession" in navigator && d > 0) {
        lastPositionState.current = now;
        try {
          navigator.mediaSession.setPositionState({ duration: d, position: Math.min(audio.currentTime, d), playbackRate: audio.playbackRate || 1 });
        } catch {
          /* ignore */
        }
      }
    };
    const onPlay = () => {
      if (isSilence()) return;
      audio.playbackRate = stateRef.current.rate;
      patch({ playing: true, error: null });
    };
    const onPlaying = () => !isSilence() && patch({ buffering: false, playing: true });
    const onPause = () => {
      if (isSilence()) return;
      patch({ playing: false, buffering: false });
      saveNow();
    };
    const onWaiting = () => !isSilence() && patch({ buffering: true });
    const onError = () => {
      if (isSilence() || !hasSource.current) return;
      patch({
        playing: false,
        buffering: false,
        error: navigator.onLine
          ? "Capitolul nu s-a putut încărca. Încearcă din nou."
          : "Ești offline. Descarcă o carte ca s-o poți asculta fără internet.",
      });
    };
    const onEnded = () => {
      if (isSilence()) return;
      const { book, index, sleep } = stateRef.current;
      if (!book) return;
      const stopHere = sleep.kind === "chapter";
      if (stopHere) {
        patch({ sleep: { kind: "off" } });
        toast("Noapte bună! Te așteptăm de unde ai rămas.");
      }
      if (index + 1 < book.chapterList.length) {
        void loadChapter(book, index + 1, 0, !stopHere).then(() => {
          if (stopHere) saveNow();
        });
      } else {
        saveProgress(book.id, { ch: 0, pos: 0, elapsed: book.seconds, done: true });
        patch({ playing: false });
        toast(`Ai terminat „${book.title}”. Felicitări!`);
      }
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
    };
  }, [loadChapter, patch, saveNow, toast]);

  // lock-screen / headphone buttons
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => resume()],
      ["pause", () => pause()],
      ["seekbackward", (d) => skip(-(d.seekOffset || 15))],
      ["seekforward", (d) => skip(d.seekOffset || 30)],
      ["seekto", (d) => d.seekTime !== undefined && seek(d.seekTime)],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* unsupported action */
      }
    }
  }, [resume, pause, skip, seek]);

  // sleep timer
  useEffect(() => {
    if (state.sleep.kind !== "timer") return;
    const endsAt = state.sleep.endsAt;
    const id = window.setInterval(() => {
      if (Date.now() >= endsAt) {
        audioRef.current?.pause();
        patch({ sleep: { kind: "off" } });
        toast("Noapte bună! Te așteptăm de unde ai rămas.");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.sleep, patch, toast]);

  // save when the tab is hidden or closed
  useEffect(() => {
    const onHide = () => saveNow();
    const onVis = () => document.visibilityState === "hidden" && saveNow();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [saveNow]);

  // on start: remember speed, and show the last book in the mini player (paused, not loaded yet)
  useEffect(() => {
    const s = getState();
    // iPhone ignores audio.volume (only the hardware buttons work), so only show the slider where it works
    const probe = new Audio();
    probe.volume = 0.5;
    const volume = typeof s.volume === "number" ? s.volume : 1;
    if (audioRef.current) audioRef.current.volume = volume;
    patch({ rate: s.rate || 1, volume, volumeSupported: Math.abs(probe.volume - 0.5) < 0.01 });
    const recent = Object.entries(s.progress)
      .filter(([, p]) => !p.done)
      .sort((a, b) => b[1].at - a[1].at)[0];
    if (!recent) return;
    loadBook(recent[0])
      .then((book) => {
        if (stateRef.current.book) return;
        const p = recent[1];
        const index = Math.min(p.ch, book.chapterList.length - 1);
        patch({ book, index });
        setTime({ time: p.pos, duration: book.chapterList[index]?.seconds ?? 0 });
        updateMediaSession(book, index);
      })
      .catch(() => {});
  }, [patch, updateMediaSession]);

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      play,
      toggle,
      pause,
      seek,
      skip,
      next,
      prev,
      setRate,
      setVolume,
      cycleRate,
      cycleSleep,
      setExpanded,
      retry,
    }),
    [state, play, toggle, pause, seek, skip, next, prev, setRate, setVolume, cycleRate, cycleSleep, setExpanded, retry],
  );

  return (
    <PlayerCtx.Provider value={api}>
      <TimeCtx.Provider value={time}>
        {children}
        {/* the one audio element for the whole app; survives page changes */}
        <audio ref={audioRef} preload="metadata" playsInline />
      </TimeCtx.Provider>
    </PlayerCtx.Provider>
  );
}
