"use client";

import { useEffect } from "react";
import { usePlayer, usePlayerTime } from "@/lib/player";
import { Cover } from "./Cover";
import { IconPause, IconPlay, IconSpinner } from "./Icons";

export function MiniPlayer() {
  const p = usePlayer();
  const { time, duration } = usePlayerTime();
  const visible = !!p.book && !p.expanded;

  useEffect(() => {
    document.body.classList.toggle("has-mini", !!p.book);
  }, [p.book]);

  if (!visible || !p.book) return null;
  const ch = p.book.chapterList[p.index];
  const total = duration || ch?.seconds || 1;
  const pct = Math.min(100, (time / total) * 100);
  const sub = p.error
    ? p.error
    : p.book.chapterList.length > 1
      ? `${ch?.title ?? ""}`
      : p.book.author;

  return (
    <div className="mini" role="region" aria-label="Player">
      <button type="button" className="mini-open" onClick={() => p.setExpanded(true)} aria-label={`Deschide playerul: ${p.book.title}`}>
        <span className="mini-cover">
          <Cover book={p.book} />
        </span>
        <span className="mini-text">
          <span className="mini-title">{p.book.title}</span>
          <span className={`mini-sub${p.error ? " error" : ""}`}>{sub}</span>
        </span>
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => (p.error ? p.retry() : p.toggle())}
        aria-label={p.playing ? "Pauză" : "Redă"}
      >
        {p.buffering && p.playing ? <IconSpinner size={26} /> : p.playing ? <IconPause size={28} /> : <IconPlay size={28} />}
      </button>
      <span className="mini-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
