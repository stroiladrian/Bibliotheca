"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { chapterOffset, usePlayer, usePlayerTime } from "@/lib/player";
import { addBookmark, removeBookmark, useStore } from "@/lib/store";
import { clock, duration as fmtDuration } from "@/lib/format";
import { Cover } from "./Cover";
import { useToast } from "./Toast";
import {
  IconBack15,
  IconBookmark,
  IconChevronDown,
  IconClose,
  IconFwd30,
  IconInfo,
  IconList,
  IconMoon,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconSpinner,
  IconMute,
  IconVolume,
} from "./Icons";

function rateLabel(r: number) {
  return `${String(r).replace(".", ",")}×`;
}

export function FullPlayer() {
  const p = usePlayer();
  const { time, duration } = usePlayerTime();
  const toast = useToast();
  const [drag, setDrag] = useState<number | null>(null);
  const [showChapters, setShowChapters] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastVolume = useRef(1);
  const currentRef = useRef<HTMLButtonElement>(null);
  const bookmarks = useStore((s) => (p.book ? s.bookmarks[p.book.id] : undefined));
  const [, setTick] = useState(0);

  const open = p.expanded && !!p.book;

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the sleep countdown ticking while paused
  useEffect(() => {
    if (!open || p.sleep.kind !== "timer") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, p.sleep.kind]);

  useEffect(() => {
    if (showChapters) currentRef.current?.scrollIntoView({ block: "center" });
  }, [showChapters]);

  if (!open || !p.book) return null;
  const book = p.book;
  const ch = book.chapterList[p.index];
  const total = duration || ch?.seconds || 0;
  const shown = drag ?? time;
  const pct = total ? (shown / total) * 100 : 0;
  const bookLeft = Math.max(0, book.seconds - chapterOffset(book, p.index) - shown);
  const multi = book.chapterList.length > 1;

  const sleepLabel =
    p.sleep.kind === "timer"
      ? clock(Math.max(0, (p.sleep.endsAt - Date.now()) / 1000))
      : p.sleep.kind === "chapter"
        ? "Final capitol"
        : "Somn";

  const commit = () => {
    if (drag !== null) p.seek(drag);
    setDrag(null);
  };

  return (
    <div className="player" role="dialog" aria-modal="true" aria-label={`Player: ${book.title}`}>
      {book.cover && <div className="player-backdrop" style={{ backgroundImage: `url("${book.cover}")` }} aria-hidden="true" />}
      <div className="player-scroll">
        <div className="player-top">
          <button ref={closeRef} type="button" className="icon-btn" onClick={() => p.setExpanded(false)} aria-label="Închide playerul">
            <IconChevronDown size={28} />
          </button>
          <div className="player-top-label">
            <small>Acum asculți</small>
            <span>{book.title}</span>
          </div>
          <Link href={`/carte/${book.id}/`} className="icon-btn" aria-label="Detalii despre carte" onClick={() => p.setExpanded(false)}>
            <IconInfo />
          </Link>
        </div>

        <div className="player-inner">
          <div className="player-cover">
            <Cover book={book} eager />
          </div>

          <div className="player-info">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="player-title">{book.title}</div>
              <div className="player-sub">
                {multi ? `${p.index + 1}/${book.chapterList.length} · ${ch?.title}` : book.author}
              </div>
            </div>
          </div>

          {p.error && (
            <div className="player-error" role="alert">
              <span>{p.error}</span>
              <button type="button" className="btn btn-small btn-ghost" onClick={p.retry}>
                Reîncearcă
              </button>
            </div>
          )}

          <div className="scrub">
            <label className="sr-only" htmlFor="scrub">
              Poziție în capitol
            </label>
            <input
              id="scrub"
              type="range"
              min={0}
              max={Math.max(1, Math.floor(total))}
              step={1}
              value={Math.floor(shown)}
              aria-valuetext={`${clock(shown)} din ${clock(total)}`}
              style={{ ["--p" as string]: `${pct}%` }}
              onChange={(e) => setDrag(Number(e.target.value))}
              onPointerUp={commit}
              onTouchEnd={commit}
              onKeyUp={commit}
              onBlur={commit}
            />
            <div className="scrub-times">
              <span>{clock(shown)}</span>
              <span>{multi ? `Mai ai ${fmtDuration(bookLeft)}` : ""}</span>
              <span>−{clock(Math.max(0, total - shown))}</span>
            </div>
          </div>

          <div className="transport">
            <button type="button" className="icon-btn" onClick={p.prev} aria-label="Capitolul anterior">
              <IconPrev size={26} />
            </button>
            <button type="button" className="icon-btn" onClick={() => p.skip(-15)} aria-label="Înapoi 15 secunde">
              <IconBack15 size={34} />
            </button>
            <button type="button" className="play-big" onClick={() => (p.error ? p.retry() : p.toggle())} aria-label={p.playing ? "Pauză" : "Redă"}>
              {p.buffering && p.playing ? <IconSpinner size={34} /> : p.playing ? <IconPause size={34} /> : <IconPlay size={36} />}
            </button>
            <button type="button" className="icon-btn" onClick={() => p.skip(30)} aria-label="Înainte 30 de secunde">
              <IconFwd30 size={34} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={p.next}
              aria-label="Capitolul următor"
              disabled={p.index + 1 >= book.chapterList.length}
            >
              <IconNext size={26} />
            </button>
          </div>

          {p.volumeSupported && (
            <div className="volume">
              <button
                type="button"
                className="icon-btn"
                aria-label={p.volume === 0 ? "Pornește sunetul" : "Oprește sunetul"}
                aria-pressed={p.volume === 0}
                onClick={() => {
                  if (p.volume > 0) {
                    lastVolume.current = p.volume;
                    p.setVolume(0);
                  } else p.setVolume(lastVolume.current || 1);
                }}
              >
                {p.volume === 0 ? <IconMute size={22} /> : <IconVolume size={22} level={p.volume} />}
              </button>
              <label className="sr-only" htmlFor="volume">
                Volum
              </label>
              <input
                id="volume"
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(p.volume * 100)}
                aria-valuetext={`${Math.round(p.volume * 100)}%`}
                style={{ ["--p" as string]: `${p.volume * 100}%` }}
                onChange={(e) => p.setVolume(Number(e.target.value) / 100)}
              />
            </div>
          )}

          <div className="player-tools">
            <button type="button" className="tool" onClick={p.cycleRate} aria-label={`Viteză de redare ${rateLabel(p.rate)}`}>
              <strong>{rateLabel(p.rate)}</strong>
              <small>Viteză</small>
            </button>
            <button
              type="button"
              className="tool"
              onClick={p.cycleSleep}
              aria-pressed={p.sleep.kind !== "off"}
              aria-label={`Cronometru de somn: ${sleepLabel}`}
            >
              <IconMoon size={20} />
              <small>{sleepLabel}</small>
            </button>
            <button type="button" className="tool" onClick={() => setShowChapters((v) => !v)} aria-expanded={showChapters}>
              <IconList size={20} />
              <small>{multi ? "Capitole" : "Semne"}</small>
            </button>
            <button
              type="button"
              className="tool"
              onClick={() => {
                addBookmark(book.id, p.index, time);
                toast(`Semn de carte adăugat la ${clock(time)}`);
              }}
            >
              <IconBookmark size={20} />
              <small>Semn de carte</small>
            </button>
          </div>

          {showChapters && (
            <div className="sheet">
              {bookmarks && bookmarks.length > 0 && (
                <>
                  <h3>Semne de carte</h3>
                  <ul className="chapters">
                    {bookmarks.map((b) => (
                      <li key={b.at} className="bookmark-row">
                        <button type="button" className="chapter" onClick={() => p.play(book, { index: b.ch, time: b.pos })}>
                          <span className="chapter-n">
                            <IconBookmark size={18} filled />
                          </span>
                          <span className="chapter-text">
                            <span className="chapter-title">
                              {multi ? `${b.ch + 1}. ${book.chapterList[b.ch]?.title ?? ""}` : book.title}
                            </span>
                            <span className="chapter-sub">la {clock(b.pos)}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Șterge semnul de carte"
                          onClick={() => removeBookmark(book.id, b.at)}
                        >
                          <IconClose size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {multi && (
                <>
                  <h3>Capitole</h3>
                  <ul className="chapters">
                    {book.chapterList.map((c, i) => (
                      <li key={c.n}>
                        <button
                          ref={i === p.index ? currentRef : undefined}
                          type="button"
                          className={`chapter${i === p.index ? " current" : ""}`}
                          aria-current={i === p.index ? "true" : undefined}
                          onClick={() => p.play(book, { index: i, time: 0 })}
                        >
                          <span className="chapter-n">{c.n}</span>
                          <span className="chapter-text">
                            <span className="chapter-title">{c.title}</span>
                            <span className="chapter-sub">{fmtDuration(c.seconds)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!multi && (!bookmarks || bookmarks.length === 0) && (
                <p className="note">Apasă „Semn de carte” ca să revii mai târziu exact în acel loc.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
