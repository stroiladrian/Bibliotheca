"use client";

import { useMemo } from "react";
import { getBookLite } from "@/lib/catalog";
import { duration } from "@/lib/format";
import { useStore } from "@/lib/store";
import { BookTile } from "./BookTile";
import { Row } from "./Row";

export function ContinueRow() {
  const progress = useStore((s) => s.progress);
  const items = useMemo(
    () =>
      Object.entries(progress)
        .filter(([, p]) => !p.done)
        .sort((a, b) => b[1].at - a[1].at)
        .slice(0, 12)
        .map(([id, p]) => ({ book: getBookLite(id), p }))
        .filter((x) => !!x.book),
    [progress],
  );
  if (!items.length) return null;
  return (
    <Row title="Continuă ascultarea" href="/biblioteca/">
      {items.map(({ book, p }) => (
        <BookTile
          key={book!.id}
          book={book!}
          progress={book!.seconds ? p.elapsed / book!.seconds : 0}
          sub={`Mai ai ${duration(Math.max(0, book!.seconds - p.elapsed))}`}
        />
      ))}
    </Row>
  );
}
