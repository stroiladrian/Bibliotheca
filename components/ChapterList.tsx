"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import { duration, plural } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { useStore } from "@/lib/store";
import { IconCheck, IconPause, IconPlay } from "./Icons";

const FIRST = 12;

export function ChapterList({ book }: { book: Book }) {
  const player = usePlayer();
  const progress = useStore((s) => s.progress[book.id]);
  const [all, setAll] = useState(book.chapterList.length <= FIRST + 3);

  const isCurrentBook = player.book?.id === book.id;
  const currentIndex = isCurrentBook ? player.index : progress && !progress.done ? progress.ch : -1;
  const list = all ? book.chapterList : book.chapterList.slice(0, Math.max(FIRST, currentIndex + 2));

  return (
    <>
      <ul className="chapters">
        {list.map((c, i) => {
          const current = i === currentIndex;
          const done = progress?.done || (currentIndex > -1 && i < currentIndex);
          const playingThis = isCurrentBook && current && player.playing;
          const sub = current && progress && !isCurrentBook ? `Ai rămas la ${duration(progress.pos)} din ${duration(c.seconds)}` : duration(c.seconds);
          return (
            <li key={c.n}>
              <button
                type="button"
                className={`chapter${current ? " current" : ""}${done ? " done" : ""}`}
                aria-current={current ? "true" : undefined}
                onClick={() => {
                  if (isCurrentBook && current) player.toggle();
                  else void player.play(book, current ? {} : { index: i, time: 0 });
                }}
              >
                <span className="chapter-n">{c.n}</span>
                <span className="chapter-text">
                  <span className="chapter-title">{c.title}</span>
                  <span className="chapter-sub">{sub}</span>
                </span>
                <span className="chapter-play" aria-hidden="true">
                  {playingThis ? <IconPause size={16} /> : done && !current ? <IconCheck size={16} /> : <IconPlay size={16} />}
                </span>
                <span className="sr-only">{playingThis ? "Pauză" : "Redă"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {!all && (
        <button type="button" className="show-all" onClick={() => setAll(true)}>
          Arată toate cele {plural(book.chapterList.length, "capitol", "capitole")}
        </button>
      )}
    </>
  );
}
