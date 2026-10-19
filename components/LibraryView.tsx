"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getBookLite } from "@/lib/catalog";
import { duration } from "@/lib/format";
import { forgetProgress, useStore } from "@/lib/store";
import { BookTile } from "./BookTile";
import { Cover } from "./Cover";
import { useToast } from "./Toast";
import { IconClose, IconPlay } from "./Icons";
import { usePlayer } from "@/lib/player";

type Tab = "curs" | "lista" | "terminate";

export function LibraryView() {
  const progress = useStore((s) => s.progress);
  const saved = useStore((s) => s.saved);
  const [tab, setTab] = useState<Tab>("curs");
  const toast = useToast();
  const player = usePlayer();

  const inProgress = useMemo(
    () =>
      Object.entries(progress)
        .filter(([, p]) => !p.done)
        .sort((a, b) => b[1].at - a[1].at)
        .map(([id, p]) => ({ book: getBookLite(id), p }))
        .filter((x) => x.book),
    [progress],
  );
  const finished = useMemo(
    () =>
      Object.entries(progress)
        .filter(([, p]) => p.done)
        .sort((a, b) => b[1].at - a[1].at)
        .map(([id]) => getBookLite(id))
        .filter(Boolean),
    [progress],
  );
  const list = useMemo(() => saved.map((id) => getBookLite(id)).filter(Boolean), [saved]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "curs", label: "În curs", count: inProgress.length },
    { key: "lista", label: "Lista mea", count: list.length },
    { key: "terminate", label: "Terminate", count: finished.length },
  ];

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 className="page-title">Biblioteca mea</h1>
        <p className="page-lead">Ce asculți, ce ți-ai pus deoparte și ce ai terminat. Totul rămâne pe acest dispozitiv.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Biblioteca mea">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            className="tab"
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "curs" &&
          (inProgress.length ? (
            <ul className="list">
              {inProgress.map(({ book, p }) => (
                <li key={book!.id} className="list-item">
                  <Link href={`/carte/${book!.id}/`} className="list-cover" aria-hidden="true" tabIndex={-1}>
                    <Cover book={book!} />
                    <span className="bar" style={{ marginTop: 6 }}>
                      <span style={{ width: `${Math.max(2, Math.min(100, (p.elapsed / Math.max(1, book!.seconds)) * 100))}%` }} />
                    </span>
                  </Link>
                  <div className="list-text">
                    <Link href={`/carte/${book!.id}/`} className="list-title">
                      {book!.title}
                    </Link>
                    <span className="list-sub">{book!.author}</span>
                    <span className="list-sub">
                      {Math.round((p.elapsed / Math.max(1, book!.seconds)) * 100)}% · mai ai {duration(Math.max(0, book!.seconds - p.elapsed))}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                    aria-label={`Continuă „${book!.title}”`}
                    onClick={() => player.play(book!.id)}
                  >
                    <IconPlay size={22} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Scoate „${book!.title}” din În curs`}
                    onClick={() => {
                      forgetProgress(book!.id);
                      toast("Am scos cartea din În curs");
                    }}
                  >
                    <IconClose size={20} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Încă n-ai început nimic" text="Alege o carte și apasă Ascultă. O găsești aici data viitoare, exact de unde ai rămas." />
          ))}

        {tab === "lista" &&
          (list.length ? (
            <div className="grid" style={{ marginTop: 20 }}>
              {list.map((b) => (
                <BookTile key={b!.id} book={b!} />
              ))}
            </div>
          ) : (
            <Empty title="Lista ta e goală" text="Apasă + pe o carte ca s-o pui deoparte pentru mai târziu." />
          ))}

        {tab === "terminate" &&
          (finished.length ? (
            <div className="grid" style={{ marginTop: 20 }}>
              {finished.map((b) => (
                <BookTile key={b!.id} book={b!} />
              ))}
            </div>
          ) : (
            <Empty title="Nicio carte terminată încă" text="Cărțile ascultate până la capăt apar aici." />
          ))}
      </div>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <span>{text}</span>
      <Link href="/" className="btn btn-small btn-primary">
        Descoperă cărți
      </Link>
    </div>
  );
}
