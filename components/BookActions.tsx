"use client";

import { useEffect, useState } from "react";
import type { Book } from "@/lib/types";
import { primeBook } from "@/lib/books";
import { cancelDownload, canDownload, downloadBook, removeDownload } from "@/lib/downloads";
import { estimateBytes, megabytes } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { getState, toggleSaved, useStore } from "@/lib/store";
import { useToast } from "./Toast";
import { IconCheck, IconDownload, IconPause, IconPlay, IconPlus, IconShare, IconTrash } from "./Icons";

export function BookActions({ book }: { book: Book }) {
  useEffect(() => primeBook(book), [book]);
  const player = usePlayer();
  const toast = useToast();
  const saved = useStore((s) => s.saved.includes(book.id));
  const progress = useStore((s) => s.progress[book.id]);
  const dl = useStore((s) => s.downloads[book.id]);
  const [confirm, setConfirm] = useState<"download" | "remove" | null>(null);

  const isCurrent = player.book?.id === book.id;
  const playingThis = isCurrent && player.playing;
  const resume = progress && !progress.done;
  const chapterNo = resume ? progress.ch + 1 : 1;

  let label = "Ascultă";
  if (playingThis) label = "Pauză";
  else if (resume) label = book.chapterList.length > 1 ? `Continuă · Capitolul ${chapterNo}` : "Continuă";
  else if (progress?.done) label = "Ascultă din nou";

  const onPrimary = () => {
    if (isCurrent) player.toggle();
    else void player.play(book);
  };

  const size = megabytes(estimateBytes(book.seconds, book.kbps));
  const downloading = dl?.status === "downloading";

  const startDownload = () => {
    setConfirm(null);
    downloadBook(book)
      .then(() => {
        if (getState().downloads[book.id]?.status === "done") toast(`„${book.title}” e gata de ascultat offline`);
      })
      .catch(() => toast("Descărcarea s-a oprit. Verifică conexiunea și încearcă din nou."));
  };

  const share = async () => {
    const url = `${location.origin}/carte/${book.id}/`;
    const data = { title: book.title, text: `${book.title} de ${book.author}, gratuit pe Bibliotheca`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        toast("Linkul a fost copiat");
      }
    } catch {
      /* user cancelled */
    }
  };

  let dlIcon = <IconDownload size={22} />;
  let dlLabel = "Descarcă";
  if (downloading) {
    dlLabel = `${dl.done}/${dl.total} · Oprește`;
  } else if (dl?.status === "done") {
    dlIcon = <IconCheck size={22} className="accent" />;
    dlLabel = "Descărcată";
  } else if (dl?.status === "partial") {
    dlLabel = `Continuă (${dl.done}/${dl.total})`;
  }

  return (
    <div className="book-actions">
      <button type="button" className="btn btn-primary" onClick={onPrimary}>
        {playingThis ? <IconPause size={22} /> : <IconPlay size={22} />}
        {label}
      </button>

      <div className="action-grid">
        <button
          type="button"
          className="action"
          aria-pressed={saved}
          onClick={() => toast(toggleSaved(book.id) ? "Adăugată în lista ta" : "Scoasă din lista ta")}
        >
          {saved ? <IconCheck size={22} className="accent" /> : <IconPlus size={22} />}
          <span>{saved ? "În lista mea" : "Lista mea"}</span>
        </button>
        <button
          type="button"
          className="action"
          disabled={!canDownload()}
          onClick={() => {
            if (downloading) cancelDownload(book.id);
            else if (dl?.status === "done") setConfirm(confirm === "remove" ? null : "remove");
            else setConfirm(confirm === "download" ? null : "download");
          }}
        >
          {dlIcon}
          <span>{dlLabel}</span>
          {downloading && (
            <span className="download-progress" aria-hidden="true">
              <span style={{ width: `${(dl.done / Math.max(1, dl.total)) * 100}%` }} />
            </span>
          )}
        </button>
        <button type="button" className="action" onClick={share}>
          <IconShare size={22} />
          <span>Distribuie</span>
        </button>
      </div>

      {confirm === "download" && (
        <div className="confirm" role="group" aria-label="Confirmă descărcarea">
          <span>
            Descarci {book.chapterList.length > 1 ? `toate cele ${book.chapterList.length} capitole` : "povestea"} (aproximativ{" "}
            {size}) ca s-o asculți fără internet. Pe date mobile poate costa; ideal e pe Wi-Fi.
          </span>
          <div className="confirm-actions">
            <button type="button" className="btn btn-small btn-primary" onClick={startDownload}>
              <IconDownload size={18} /> Descarcă {size}
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirm(null)}>
              Renunță
            </button>
          </div>
        </div>
      )}
      {confirm === "remove" && (
        <div className="confirm" role="group" aria-label="Șterge descărcarea">
          <span>Ștergi fișierele descărcate? Progresul și lista ta rămân.</span>
          <div className="confirm-actions">
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => {
                setConfirm(null);
                void removeDownload(book).then(() => toast("Descărcarea a fost ștearsă"));
              }}
            >
              <IconTrash size={18} /> Șterge
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirm(null)}>
              Renunță
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
