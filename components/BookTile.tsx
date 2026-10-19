import Link from "next/link";
import type { BookLite, UpcomingBook } from "@/lib/types";
import { Cover } from "./Cover";
import { duration } from "@/lib/format";

export function BookTile({
  book,
  progress,
  sub,
  size = "md",
}: {
  book: BookLite;
  progress?: number; // 0..1
  sub?: string;
  size?: "md" | "lg";
}) {
  return (
    <Link href={`/carte/${book.id}/`} className={`tile tile-${size}`} aria-label={`${book.title}, ${book.author}`}>
      <span className="tile-cover">
        <Cover book={book} />
        {book.narration === "ai" && <span className="badge badge-ai">Voce AI</span>}
        {book.narration === "human" && <span className="badge">LibriVox</span>}
      </span>
      {progress !== undefined && (
        <span className="bar" aria-hidden="true">
          <span style={{ width: `${Math.max(2, Math.min(100, progress * 100))}%` }} />
        </span>
      )}
      <span className="tile-title">{book.title}</span>
      <span className="tile-sub">{sub ?? `${book.author.split(" și ")[0]} · ${duration(book.seconds)}`}</span>
    </Link>
  );
}

export function UpcomingTile({ book }: { book: UpcomingBook }) {
  return (
    <div className="tile tile-upcoming" aria-label={`${book.title}, ${book.author}, în curând`}>
      <span className="tile-cover">
        <Cover book={{ ...book, cover: book.cover }} />
        <span className="badge badge-soon">În curând</span>
      </span>
      <span className="tile-title">{book.title}</span>
      <span className="tile-sub">{book.author}</span>
    </div>
  );
}
