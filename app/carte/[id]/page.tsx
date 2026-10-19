import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import type { Book } from "@/lib/types";
import { BOOKS, categoryTitle, similar } from "@/lib/catalog";
import { duration, plural } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { BookActions } from "@/components/BookActions";
import { ChapterList } from "@/components/ChapterList";
import { Row } from "@/components/Row";
import { BookTile } from "@/components/BookTile";
import { IconBack, IconMic } from "@/components/Icons";

export const dynamicParams = false;

export function generateStaticParams() {
  return BOOKS.map((b) => ({ id: b.id }));
}

async function getBook(id: string): Promise<Book> {
  const file = path.join(process.cwd(), "public", "data", "books", `${id}.json`);
  return JSON.parse(await readFile(file, "utf8")) as Book;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id);
  return {
    title: `${book.title}, de ${book.author}`,
    description: book.blurb,
    openGraph: { title: book.title, description: book.blurb, images: book.cover ? [book.cover] : [] },
  };
}

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await getBook(id);
  const more = similar(book, 12);
  const multi = book.chapterList.length > 1;

  return (
    <>
      <div className="book-top">
        {book.cover && <div className="hero-backdrop" style={{ backgroundImage: `url("${book.cover}")` }} aria-hidden="true" />}
        <div className="wrap">
          <Link href="/" className="btn btn-small btn-ghost" style={{ marginTop: 8 }}>
            <IconBack size={18} /> Acasă
          </Link>
          <div className="book-head">
            <div className="book-cover">
              <Cover book={book} eager />
            </div>
            <div>
              <h1 className="book-title">{book.title}</h1>
              {book.titleRo && book.titleRo !== book.title && <div className="book-title-ro">{book.titleRo}</div>}
              <div className="book-author">
                {book.author}
                {book.authorYears ? ` (${book.authorYears})` : ""}
              </div>
              <div className="book-meta">
                {[
                  book.year ? String(book.year) : null,
                  duration(book.seconds),
                  multi ? plural(book.chapterList.length, "capitol", "capitole") : null,
                  book.cats.map(categoryTitle).join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div className="book-narrator">
                <IconMic size={15} />
                {book.narration === "ai" ? `Citită de ${book.narrator}` : `Citită de ${book.narrator} · LibriVox`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="book-body">
          <BookActions book={book} />
          <p className="blurb">{book.blurb}</p>

          {multi && (
            <>
              <h2 className="section-title">Capitole</h2>
              <ChapterList book={book} />
            </>
          )}

          <h2 className="section-title">Despre această înregistrare</h2>
          {book.original ? (
            <p className="note">
              Operă originală de {book.author}, scrisă pentru Bibliotheca. Fiecare poem este citit de două
              voci sintetice ({book.narrator}). Toate drepturile asupra textelor aparțin autoarei.
            </p>
          ) : book.narration === "ai" ? (
            <p className="note">
              Textul vine de pe Wikisource și este în domeniul public. L-am transformat în audio cu o voce sintetică
              ({book.narrator}), așa că pot apărea accente greșite sau cuvinte vechi pronunțate ciudat.
            </p>
          ) : (
            <>
              <p className="note">
                Înregistrare LibriVox: voluntari care citesc cărți din domeniul public și le oferă gratuit oricui. Descrierea de mai jos
                e scrisă de ei.
              </p>
              {book.about && <p className="about">{book.about}</p>}
            </>
          )}
          <ul className="sources">
            {book.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {more.length > 0 && (
        <Row title="Îți mai pot plăcea">
          {more.map((b) => (
            <BookTile key={b.id} book={b} />
          ))}
        </Row>
      )}
    </>
  );
}
