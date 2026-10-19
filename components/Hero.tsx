"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { featuredFor, getBookLite } from "@/lib/catalog";
import { duration, voiceLabel } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { toggleSaved, useStore } from "@/lib/store";
import { Cover } from "./Cover";
import { useToast } from "./Toast";
import { IconCheck, IconInfo, IconPlay, IconPlus } from "./Icons";

export function Hero({ initialId }: { initialId: string }) {
  const [id, setId] = useState(initialId);
  useEffect(() => setId(featuredFor(new Date()).id), []);
  const book = getBookLite(id)!;
  const player = usePlayer();
  const toast = useToast();
  const saved = useStore((s) => s.saved.includes(book.id));
  const progress = useStore((s) => s.progress[book.id]);
  const resuming = progress && !progress.done;

  return (
    <section className="hero" aria-label="Alegerea săptămânii">
      {book.cover && <div className="hero-backdrop" style={{ backgroundImage: `url("${book.cover}")` }} aria-hidden="true" />}
      <div className="wrap hero-inner">
        <Link href={`/carte/${book.id}/`} className="hero-cover" aria-label={`Detalii: ${book.title}`}>
          <Cover book={book} eager />
        </Link>
        <div className="hero-text">
          <span className="kicker">Alegerea săptămânii</span>
          <h1 className={`hero-title${book.title.length > 16 ? " long" : ""}`}>{book.title}</h1>
          <span className="hero-meta">
            {book.author} · {duration(book.seconds)} · {voiceLabel(book.narration)}
          </span>
          <p className="hero-blurb">{book.blurb}</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => player.play(book.id)}>
              <IconPlay size={22} />
              {resuming ? "Continuă" : "Ascultă"}
            </button>
            <Link href={`/carte/${book.id}/`} className="btn btn-ghost btn-square" aria-label={`Detalii despre ${book.title}`}>
              <IconInfo size={22} />
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-square"
              aria-pressed={saved}
              aria-label={saved ? "Scoate din lista mea" : "Adaugă în lista mea"}
              onClick={() => toast(toggleSaved(book.id) ? "Adăugată în lista ta" : "Scoasă din lista ta")}
            >
              {saved ? <IconCheck size={22} /> : <IconPlus size={22} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
