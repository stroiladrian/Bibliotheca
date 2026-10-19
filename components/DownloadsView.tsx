"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBookLite } from "@/lib/catalog";
import { loadBook } from "@/lib/books";
import { canDownload, cancelDownload, removeDownload, storageEstimate } from "@/lib/downloads";
import { megabytes } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { useStore } from "@/lib/store";
import { Cover } from "./Cover";
import { useToast } from "./Toast";
import { IconPlay, IconTrash, IconClose } from "./Icons";

export function DownloadsView() {
  const downloads = useStore((s) => s.downloads);
  const player = usePlayer();
  const toast = useToast();
  const [space, setSpace] = useState<{ usage: number; quota: number } | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(canDownload());
    storageEstimate().then(setSpace);
  }, [downloads]);

  const items = useMemo(
    () =>
      Object.entries(downloads)
        .sort((a, b) => b[1].at - a[1].at)
        .map(([id, d]) => ({ book: getBookLite(id), d }))
        .filter((x) => x.book),
    [downloads],
  );
  const total = items.reduce((s, x) => s + x.d.bytes, 0);

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 className="page-title">Descărcări</h1>
        <p className="page-lead">Cărțile descărcate se aud și fără internet: în avion, în metrou, la munte.</p>
      </div>

      {!supported && (
        <div className="empty">
          <strong>Browserul nu permite descărcări</strong>
          <span>Deschide Bibliotheca în Safari sau Chrome, ideal adăugată pe ecranul principal.</span>
        </div>
      )}

      {supported && (
        <div className="storage">
          {items.length ? `Ai descărcat ${megabytes(total)}.` : "Nu ai nimic descărcat încă."}
          {space && space.quota > 0 && ` Spațiu disponibil pentru aplicație: aproximativ ${megabytes(Math.max(0, space.quota - space.usage))}.`}
          <br />
          <span className="note">Sfat: pe iPhone, adaugă Bibliotheca pe ecranul principal (Distribuie → Adaugă pe ecranul principal), ca descărcările să nu fie șterse automat.</span>
        </div>
      )}

      {items.length > 0 ? (
        <ul className="list">
          {items.map(({ book, d }) => {
            const b = book!;
            const status =
              d.status === "downloading"
                ? `Se descarcă… ${d.done}/${d.total}`
                : d.status === "done"
                  ? `Gata · ${megabytes(d.bytes)}`
                  : d.status === "partial"
                    ? `Parțial: ${d.done}/${d.total} capitole · ${megabytes(d.bytes)}`
                    : "Descărcarea a eșuat";
            return (
              <li key={b.id} className="list-item">
                <Link href={`/carte/${b.id}/`} className="list-cover" aria-hidden="true" tabIndex={-1}>
                  <Cover book={b} />
                </Link>
                <div className="list-text">
                  <Link href={`/carte/${b.id}/`} className="list-title">
                    {b.title}
                  </Link>
                  <span className="list-sub">{b.author}</span>
                  <span className="list-sub">{status}</span>
                  {d.status === "downloading" && (
                    <span className="bar" aria-hidden="true">
                      <span style={{ width: `${(d.done / Math.max(1, d.total)) * 100}%` }} />
                    </span>
                  )}
                </div>
                {d.status === "downloading" ? (
                  <button type="button" className="icon-btn" aria-label="Oprește descărcarea" onClick={() => cancelDownload(b.id)}>
                    <IconClose size={20} />
                  </button>
                ) : (
                  <>
                    {d.done > 0 && (
                      <button type="button" className="icon-btn" aria-label={`Ascultă „${b.title}”`} onClick={() => player.play(b.id)}>
                        <IconPlay size={22} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Șterge descărcarea „${b.title}”`}
                      onClick={async () => {
                        try {
                          await removeDownload(await loadBook(b.id));
                          toast("Descărcarea a fost ștearsă");
                        } catch {
                          toast("Nu am putut șterge acum. Încearcă din nou.");
                        }
                      }}
                    >
                      <IconTrash size={20} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        supported && (
          <div className="empty">
            <strong>Nimic descărcat încă</strong>
            <span>Pe pagina unei cărți apasă „Descarcă”. O povestire de 15 minute are cam 6 MB, un roman lung câteva sute.</span>
            <Link href="/" className="btn btn-small btn-primary">
              Alege o carte
            </Link>
          </div>
        )
      )}
    </div>
  );
}
