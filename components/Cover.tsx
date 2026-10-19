"use client";

import { useState } from "react";
import type { BookLite } from "@/lib/types";

const PALETTES: [string, string][] = [
  ["#6E1A26", "#F6E3D3"],
  ["#2F5D50", "#F1EAD2"],
  ["#1F3B73", "#E6EDFA"],
  ["#2A2A2E", "#E9DBB8"],
  ["#8A5A1F", "#FBF0DC"],
  ["#4A5A27", "#F0F2DE"],
  ["#3B2D5E", "#ECE6FA"],
  ["#35585A", "#E3F0EE"],
  ["#5A3A22", "#F5E6D3"],
  ["#23283F", "#E4E7F7"],
];

function paletteFor(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

type CoverBook = Pick<BookLite, "id" | "title" | "author" | "cover" | "palette">;

export function Cover({ book, className = "", eager = false }: { book: CoverBook; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (book.cover && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`cover ${className}`}
        src={book.cover}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  const [bg, fg] = book.palette ?? paletteFor(book.id);
  return (
    <div className={`cover cover-fallback ${className}`} style={{ background: bg, color: fg }} aria-hidden="true">
      <span className="cover-ring" style={{ borderColor: fg }} />
      <span className="cover-author">{book.author}</span>
      <span className="cover-title">{book.title}</span>
    </div>
  );
}
