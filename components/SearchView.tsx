"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BOOKS, CATEGORIES, LENGTHS, UPCOMING, categoryBooks, searchBooks, searchUpcoming, type LengthFilter, type SearchFilters, type VoiceFilter } from "@/lib/catalog";
import { plural } from "@/lib/format";
import { BookTile, UpcomingTile } from "./BookTile";
import { IconClose, IconSearch } from "./Icons";

const CAT_COLORS: Record<string, [string, string]> = {
  basme: ["#2F5D50", "#F1EAD2"],
  copii: ["#4A5A27", "#F0F2DE"],
  nuvele: ["#6E1A26", "#F6E3D3"],
  umor: ["#8A5A1F", "#FBF0DC"],
  poezie: ["#3B2D5E", "#ECE6FA"],
  romane: ["#1F3B73", "#E6EDFA"],
};

const EMPTY: SearchFilters = { q: "", cat: "", voice: "", len: "" };

function readUrl(): SearchFilters {
  if (typeof window === "undefined") return EMPTY;
  const p = new URLSearchParams(window.location.search);
  const voice = p.get("voice");
  return {
    q: p.get("q") ?? "",
    cat: p.get("cat") ?? "",
    voice: (voice === "human" || voice === "ai" ? voice : "") as VoiceFilter,
    len: (LENGTHS.find((l) => l.key === p.get("len"))?.key ?? "") as LengthFilter,
  };
}

export function SearchView() {
  const [f, setF] = useState<SearchFilters>(EMPTY);
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setF(readUrl());
    setReady(true);
    const onPop = () => setF(readUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.cat) p.set("cat", f.cat);
    if (f.voice) p.set("voice", f.voice);
    if (f.len) p.set("len", f.len);
    const qs = p.toString();
    window.history.replaceState(window.history.state, "", qs ? `?${qs}` : window.location.pathname);
  }, [f, ready]);

  const set = (patch: Partial<SearchFilters>) => setF((x) => ({ ...x, ...patch }));
  const filtering = !!(f.q || f.cat || f.voice || f.len);
  const results = useMemo(() => searchBooks(f), [f]);
  const soon = useMemo(() => searchUpcoming(f), [f]);
  const catTitle = CATEGORIES.find((c) => c.key === f.cat)?.title;

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 className="page-title">{catTitle && !f.q ? catTitle : "Caută"}</h1>
        <p className="page-lead">
          {BOOKS.length} cărți audio gratuite în limba română, plus {UPCOMING.length} care se înregistrează acum.
        </p>
      </div>

      <div className="searchbox">
        <IconSearch size={20} />
        <label htmlFor="q" className="sr-only">
          Caută după titlu sau autor
        </label>
        <input
          ref={input}
          id="q"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Titlu, autor sau temă"
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
        />
        {f.q && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Șterge căutarea"
            onClick={() => {
              set({ q: "" });
              input.current?.focus();
            }}
          >
            <IconClose size={20} />
          </button>
        )}
      </div>

      <div className="filter-label">Categorie</div>
      <div className="chips" role="group" aria-label="Categorie">
        <button type="button" className="chip" aria-pressed={!f.cat} onClick={() => set({ cat: "" })}>
          Toate
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.key} type="button" className="chip" aria-pressed={f.cat === c.key} onClick={() => set({ cat: f.cat === c.key ? "" : c.key })}>
            {c.title}
          </button>
        ))}
      </div>

      <div className="filter-label">Voce și durată</div>
      <div className="chips" role="group" aria-label="Voce și durată">
        <button type="button" className="chip" aria-pressed={f.voice === "human"} onClick={() => set({ voice: f.voice === "human" ? "" : "human" })}>
          Voce umană (LibriVox)
        </button>
        <button type="button" className="chip" aria-pressed={f.voice === "ai"} onClick={() => set({ voice: f.voice === "ai" ? "" : "ai" })}>
          Voce AI
        </button>
        {LENGTHS.map((l) => (
          <button key={l.key} type="button" className="chip" aria-pressed={f.len === l.key} onClick={() => set({ len: f.len === l.key ? "" : l.key })}>
            {l.label}
          </button>
        ))}
      </div>

      {!filtering ? (
        <>
          <div className="cat-grid">
            {CATEGORIES.map((c) => {
              const [bg, fg] = CAT_COLORS[c.key] ?? ["#2A2A2E", "#F5F5F4"];
              return (
                <button key={c.key} type="button" className="cat-tile" style={{ background: bg, color: fg }} onClick={() => set({ cat: c.key })}>
                  <strong>{c.title}</strong>
                  <small>{plural(categoryBooks(c.key).length, "carte", "cărți")}</small>
                </button>
              );
            })}
          </div>
          <h2 className="section-title" style={{ marginTop: 34 }}>
            Toate cărțile
          </h2>
          <div className="grid" style={{ marginTop: 14 }}>
            {[...BOOKS]
              .sort((a, b) => a.title.localeCompare(b.title, "ro"))
              .map((b) => (
                <BookTile key={b.id} book={b} />
              ))}
          </div>
        </>
      ) : (
        <>
          <p className="results-count" role="status">
            {results.length ? plural(results.length, "carte găsită", "cărți găsite") : soon.length ? "Nimic de ascultat încă, dar vine în curând:" : "Nicio carte nu se potrivește."}
          </p>
          {results.length > 0 ? (
            <div className="grid">
              {results.map((b) => (
                <BookTile key={b.id} book={b} />
              ))}
            </div>
          ) : soon.length ? null : (
            <div className="empty">
              <strong>N-am găsit nimic</strong>
              <span>Încearcă alt cuvânt sau scoate un filtru, de exemplu „Creangă” sau „basm”.</span>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setF(EMPTY)}>
                Șterge filtrele
              </button>
            </div>
          )}
          {soon.length > 0 && (
            <>
              <h2 className="section-title" style={{ marginTop: 34 }}>
                În curând
              </h2>
              <div className="grid" style={{ marginTop: 14 }}>
                {soon.map((b) => (
                  <UpcomingTile key={b.id} book={b} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
